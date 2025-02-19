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
    this.logger.debug(
      `Creating message: ${JSON.stringify({ senderId, ...dto })}`,
    );

    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        senderId,
        receiverId: dto.receiverId,
      },
    });

    this.logger.debug(`Message created with ID: ${message.id}`);
    return message;
  }

  async getConversation(userId: number, otherId: number) {
    this.logger.debug(
      `Fetching conversation between users ${userId} and ${otherId}`,
    );
    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherId },
          { senderId: otherId, receiverId: userId },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async markAsRead(messageIds: number[]) {
    this.logger.debug(`Marking messages as read: ${messageIds.join(', ')}`);
    return this.prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        read: false,
      },
      data: { read: true },
    });
  }
}
