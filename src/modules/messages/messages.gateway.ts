import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/message.dto';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { ChatService } from '../chat/chat.service';

@WebSocketGateway({
  cors: {
    origin: true,
  },
  namespace: '/chat',
})
@UseGuards(WsAuthGuard)
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private messagesService: MessagesService,
    private chatService: ChatService,
    private wsAuthGuard: WsAuthGuard, // 注入 WsAuthGuard
  ) {}

  async handleConnection(client: Socket) {
    try {
      // 在连接时进行认证
      await this.wsAuthGuard.handleConnection(client);
      const userId = client.data.userId;
      this.logger.log(`Client connected: ${client.id}, userId: ${userId}`);

      // 自动订阅用户参与的所有聊天室
      const chats = await this.chatService.findAll(userId);
      for (const chat of chats) {
        const roomId = `chat:${chat.id}`;
        await client.join(roomId);
        this.logger.log(
          `Auto-subscribed client ${client.id} to chat ${chat.id}`,
        );
      }
    } catch (error) {
      // 处理连接错误
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    this.logger.log(`Client disconnected: ${client.id}, userId: ${userId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ) {
    try {
      const senderId = client.data.userId as number;
      const message = await this.messagesService.sendMessage(senderId, payload);
      const roomId = `chat:${payload.chatId}`;

      // 将消息广播给同一聊天室的所有成员;
      this.server.to(roomId).emit('newMessage', {
        ...message,
        chatId: payload.chatId,
      });
    } catch (error) {
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('subscribeToChat')
  async handleSubscribeToChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatId: number,
  ) {
    const userId = client.data.userId;

    // 验证用户是否有权限访问该聊天室
    const members = await this.chatService.getChatMembers(chatId);
    const isMember = members.some((member) => member.userId === userId);

    if (!isMember) {
      throw new WsException('Unauthorized to join this chat');
    }

    const roomId = `chat:${chatId}`;
    await client.join(roomId);
    this.logger.log(`Client ${client.id} subscribed to chat ${chatId}`);

    return { success: true };
  }

  @SubscribeMessage('unsubscribeFromChat')
  async handleUnsubscribeFromChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatId: number,
  ) {
    const roomId = `chat:${chatId}`;
    await client.leave(roomId);
    this.logger.log(`Client ${client.id} unsubscribed from chat ${chatId}`);
    return { success: true };
  }

  @SubscribeMessage('getChatHistory')
  async handleGetChatHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatId: number,
  ) {
    try {
      const userId = client.data.userId;

      // 验证用户是否有权限访问该聊天室
      const members = await this.chatService.getChatMembers(chatId);
      const isMember = members.some((member) => member.userId === userId);

      if (!isMember) {
        throw new WsException('Unauthorized to access chat messages');
      }

      const messages = await this.messagesService.getChatMessages(chatId);
      return { success: true, messages };
    } catch (error) {
      this.logger.error(`Error getting messages: ${error.message}`);
      throw new WsException(error.message);
    }
  }
}
