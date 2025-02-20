import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
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
    // 验证发送者是否是聊天成员
    const isMember = await this.prisma.chatMember.findFirst({
      where: {
        userId: senderId,
        chatId: dto.chatId,
      },
    });

    if (!isMember) {
      throw new ForbiddenException('User is not a member of this chat');
    }

    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        senderId,
        chatId: dto.chatId,
        type: dto.type || 'text',
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        chat: true,
      },
    });

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
    this.logger.debug(`Fetching messages for chat ${chatId}`);
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
      orderBy: { createdAt: 'asc' },
    });
  }

  async getChatMemberIds(chatId: number): Promise<number[]> {
    const members = await this.prisma.chatMember.findMany({
      where: { chatId },
      select: { userId: true },
    });

    return members.map((member) => member.userId);
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
