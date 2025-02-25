import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { ChatService } from '../chat/chat.service';

@WebSocketGateway({
  cors: { origin: true },
  namespace: '/',
  maxHttpBufferSize: 1e8,
  // 服务端心跳配置
  pingTimeout: 60000,
  pingInterval: 25000,
})
@UseGuards(WsAuthGuard)
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  protected server: Server;

  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly wsAuthGuard: WsAuthGuard,
    protected readonly chatService: ChatService,
  ) {}

  // 处理连接事件，用户连接时自动订阅相关聊天室
  async handleConnection(client: Socket) {
    try {
      // 1. 验证用户身份
      await this.wsAuthGuard.handleConnection(client);
      const userId = client.data.userId;
      this.logger.log(`Client connected: ${client.id}, userId: ${userId}`);

      // 2. 自动订阅该用户所在的所有聊天室
      const chats = await this.chatService.findAll(userId);
      for (const chat of chats) {
        const roomId = `chat:${chat.id}`;
        await client.join(roomId); // Socket.IO房间订阅
        this.logger.log(
          `Auto-subscribed client ${client.id} to chat ${chat.id}`,
        );
      }
    } catch (error) {
      // 验证失败断开连接
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  // 处理连接断开
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    this.logger.log(`Client disconnected: ${client.id}, userId: ${userId}`);
  }
}
