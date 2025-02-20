import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/message.dto';

@WebSocketGateway({
  cors: {
    origin: true, // 允许所有来源
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization'],
  },
  namespace: '/chat',
})
@UseGuards(WsAuthGuard)
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<number, string>();
  private readonly logger = new Logger(MessagesGateway.name);

  constructor(private messagesService: MessagesService) {}

  handleConnection(client: Socket) {
    const userId = client.data.userId as number;
    this.connectedUsers.set(userId, client.id);
    this.logger.log(`User ${userId} connected. Socket ID: ${client.id}`);
    client.broadcast.emit('userOnline', { userId });
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as number;
    this.connectedUsers.delete(userId);
    this.logger.log(`User ${userId} disconnected. Socket ID: ${client.id}`);
    client.broadcast.emit('userOffline', { userId });
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ) {
    const senderId = client.data.userId as number;
    const message = await this.messagesService.sendMessage(senderId, payload);

    // 获取聊天室所有成员ID
    const memberIds = await this.messagesService.getChatMemberIds(
      payload.chatId,
    );

    // 向所有在线的聊天成员发送消息
    memberIds.forEach((memberId) => {
      const memberSocketId = this.connectedUsers.get(memberId);
      if (memberSocketId && memberSocketId !== client.id) {
        this.server.to(memberSocketId).emit('newMessage', message);
      }
    });

    return message;
  }

  @SubscribeMessage('joinChat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatId: number,
  ) {
    await client.join(`chat:${chatId}`);
    this.logger.debug(`User ${client.data.userId} joined chat ${chatId}`);
  }

  @SubscribeMessage('leaveChat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatId: number,
  ) {
    await client.leave(`chat:${chatId}`);
    this.logger.debug(`User ${client.data.userId} left chat ${chatId}`);
  }
}
