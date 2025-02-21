import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

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

    // 删除聊天及相关消息
    await this.prisma.chat.delete({
      where: {
        id: chatId,
      },
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
}
