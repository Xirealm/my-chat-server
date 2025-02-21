import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // 每次获取最近的50条消息
    });
  }
}
