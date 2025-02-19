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
    origin: '*',
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

    this.logger.log(
      `Message sent from user ${senderId} to user ${payload.receiverId}: ${payload.content.substring(0, 50)}...`,
    );

    const receiverSocketId = this.connectedUsers.get(payload.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('newMessage', message);
      this.logger.debug(`Message delivered to socket ${receiverSocketId}`);
    } else {
      this.logger.debug(`Receiver ${payload.receiverId} is offline`);
    }

    return message;
  }
}
