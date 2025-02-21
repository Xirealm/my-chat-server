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

  constructor(private messagesService: MessagesService) {}

  handleConnection(client: Socket) {
    const userId = client.data.userId;
    this.logger.log(`Client connected: ${client.id}, userId: ${userId}`);
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

      // 只广播消息，不返回数据
      this.server.emit('newMessage', {
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
    const roomId = `chat:${chatId}`;
    await client.join(roomId);
    this.logger.log(`Client ${client.id} subscribed to chat ${chatId}`);

    // 获取聊天历史消息
    const messages = await this.messagesService.getChatMessages(chatId);
    return { success: true, messages };
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
}
