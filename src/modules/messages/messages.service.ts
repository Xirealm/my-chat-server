import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto, MessageResponse } from './dto/message.dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private prisma: PrismaService) {}

  async sendMessage(
    senderId: number,
    dto: SendMessageDto,
  ): Promise<MessageResponse> {
    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        senderId,
        chatId: dto.chatId,
        type: 'text', // 默认为文本消息
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // 更新聊天室最后一条消息
    await this.prisma.chat.update({
      where: { id: dto.chatId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date(),
      },
    });

    return message;
  }

  async getChatMessages(chatId: number) {
    return this.prisma.message.findMany({
      where: { chatId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        file: true, // 添加文件信息关联
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // 每次获取最近的50条消息
    });
  }

  async createFileMessage(data: {
    senderId: number;
    chatId: number;
    type: string;
    content: string;
    fileId: number;
  }) {
    return this.prisma.message.create({
      data: {
        senderId: data.senderId,
        chatId: data.chatId,
        type: data.type,
        content: data.content,
        fileId: data.fileId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        file: true, // 包含文件信息
      },
    });
  }
}
