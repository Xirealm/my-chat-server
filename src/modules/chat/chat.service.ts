import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path'; // 新增：导入 path 模块

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  // 获取用户的聊天列表
  async findAll(userId: number) {
    const chats = await this.prisma.chat.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        type: true,
        name: true, // 添加 name 字段
        updatedAt: true,
        lastMessage: {
          select: {
            content: true,
            type: true,
            createdAt: true,
          },
        },
        members: {
          where: {
            userId: {
              not: userId,
            },
          },
          select: {
            user: {
              select: {
                avatar: true,
                username: true,
              },
            },
          },
        },
      },
    });

    // 转换数据结构
    return chats.map((chat) => ({
      id: chat.id,
      type: chat.type,
      updatedAt: chat.updatedAt.toLocaleString(),
      avatar: chat.members[0]?.user.avatar || null,
      name:
        chat.type === 'private'
          ? chat.members[0]?.user.username || '未知'
          : chat.name,
      lastMessage: chat.lastMessage
        ? {
            content: chat.lastMessage.content,
            type: chat.lastMessage.type,
          }
        : null,
    }));
  }

  // 创建或查找私聊
  async findOrCreatePrivateChat(user1Id: number, user2Id: number) {
    // 查找现有的私聊
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        type: 'private',
        AND: [
          { members: { some: { userId: user1Id } } },
          { members: { some: { userId: user2Id } } },
        ],
      },
      select: {
        id: true,
      },
    });

    if (existingChat) {
      return { chatId: existingChat.id };
    }

    // 创建新的私聊
    const newChat = await this.prisma.chat.create({
      data: {
        type: 'private',
        members: {
          create: [
            { userId: user1Id, role: 'member' },
            { userId: user2Id, role: 'member' },
          ],
        },
      },
      select: {
        id: true,
      },
    });

    return { chatId: newChat.id };
  }

  async createGroupChat(creatorId: number, memberIds: number[]) {
    // 直接将创建者加入成员列表
    const allMemberIds = [...memberIds, creatorId];

    // 验证所有用户是否存在
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: allMemberIds,
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    if (users.length !== allMemberIds.length) {
      throw new BadRequestException('部分用户不存在');
    }

    // 生成群聊名称
    let groupName =
      '群：' +
      users
        .map((user) => user.username)
        .join('、')
        .slice(0, 13); // 调整切片长度以适应新增的前缀

    if (groupName.length === 15 && users.length > 2) {
      groupName = groupName.slice(0, 12) + '...';
    }

    // 创建群聊
    const chat = await this.prisma.chat.create({
      data: {
        type: 'group',
        name: groupName,
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            role: userId === creatorId ? 'owner' : 'member',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return chat;
  }

  private async deleteFileAndChunks(filePath: string) {
    try {
      const baseFilePath = path.resolve(process.cwd(), 'uploads');
      const filename = path.basename(filePath);
      const fullPath = path.join(baseFilePath, filename);
      const fileId = path.parse(filename).name; // 使用文件名（不含扩展名）作为 fileId
      const chunkDir = path.join(baseFilePath, 'chunks', fileId);

      // 删除主文件
      await fs.access(fullPath);
      await fs.unlink(fullPath);
      this.logger.log(`Successfully deleted file: ${fullPath}`);

      // 删除分片目录
      try {
        await fs.access(chunkDir);
        await fs.rm(chunkDir, { recursive: true, force: true });
        this.logger.log(`Successfully deleted chunk directory: ${chunkDir}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.warn(
            `Failed to delete chunk directory: ${chunkDir}`,
            error,
          );
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(`Error deleting file: ${filePath}`, error);
      }
    }
  }

  async deleteChat(chatId: number, userId: number) {
    // 验证用户是否在这个聊天中
    const chat = await this.prisma.chat.findFirst({
      where: {
        id: chatId,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });

    if (!chat) {
      throw new Error('Chat not found or user not authorized');
    }

    // 使用事务确保原子性
    await this.prisma.$transaction(async (tx) => {
      // 1. 获取所有文件消息及其文件信息
      const fileMessages = await tx.message.findMany({
        where: {
          chatId,
          type: 'file',
        },
        include: {
          file: true,
        },
      });

      // 2. 清除 Chat 的 lastMessageId 引用
      await tx.chat.update({
        where: { id: chatId },
        data: { lastMessageId: null },
      });

      // 3. 删除所有聊天成员
      await tx.chatMember.deleteMany({
        where: { chatId },
      });

      // 4. 删除所有消息（这会自动处理 Message 和 File 之间的关系）
      await tx.message.deleteMany({
        where: { chatId },
      });

      // 5. 删除所有文件记录和物理文件
      for (const message of fileMessages) {
        if (message.file) {
          try {
            // 删除文件和相关分片
            await this.deleteFileAndChunks(message.file.path);

            // 删除文件记录
            await tx.file.delete({
              where: { id: message.file.id },
            });
          } catch (error) {
            this.logger.error(
              `Error processing file deletion for message ${message.id}:`,
              error,
            );
            // 继续执行，不中断删除过程
          }
        }
      }

      // 6. 删除聊天本身
      await tx.chat.delete({
        where: { id: chatId },
      });
    });

    return { success: true };
  }

  async getChatMembers(chatId: number) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat.members;
  }

  async getHistoryMessages(
    chatId: number,
    userId: number,
    page: number = 1,
    pageSize: number = 50,
    keyword?: string,
  ) {
    // 确保页码和每页数量为有效的数字
    const validPage = Math.max(1, page);
    const validPageSize = Math.max(1, Math.min(100, pageSize));
    const skip = (validPage - 1) * validPageSize;

    // 验证用户是否在这个聊天中
    const isMember = await this.prisma.chatMember.findFirst({
      where: {
        AND: [{ chatId: chatId }, { userId: userId }],
      },
    });

    if (!isMember) {
      throw new NotFoundException('Chat not found or user not authorized');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        chatId: chatId,
        OR: keyword
          ? [
              {
                content: {
                  contains: keyword,
                },
                type: 'text',
              },
              {
                file: {
                  filename: {
                    contains: keyword,
                  },
                },
                type: 'file',
              },
            ]
          : undefined,
      },
      include: {
        sender: {
          select: {
            username: true,
            avatar: true,
          },
        },
        file: true, // 包含文件信息
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: validPageSize,
      skip: skip, // 使用计算好的 skip 值
    });

    return messages;
  }

  async getFileMessage(messageId: number) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        file: true,
      },
    });

    if (!message || !message.file) {
      throw new NotFoundException('File not found');
    }

    return {
      path: message.file.path,
      filename: message.file.filename,
      mimetype: message.file.mimetype,
    };
  }
}
