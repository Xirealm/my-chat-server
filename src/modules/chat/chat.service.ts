import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
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
      name: chat.members[0]?.user.username || '未知',
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
      // 1. 删除所有聊天成员
      await tx.chatMember.deleteMany({
        where: { chatId },
      });

      // 2. 删除所有消息
      await tx.message.deleteMany({
        where: { chatId },
      });

      // 3. 删除聊天本身
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
