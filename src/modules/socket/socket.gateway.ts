import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
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

  // 存储聊天室的在线用户
  protected chatOnlineUsers: Map<string, Set<number>> = new Map();

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
        // 获取或创建聊天室的在线用户集合
        let userSet = this.chatOnlineUsers.get(roomId);
        if (!userSet) {
          userSet = new Set<number>();
          this.chatOnlineUsers.set(roomId, userSet);
        }
        // 将用户添加到在线用户集合
        userSet.add(userId);

        // 获取真实的在线用户数
        const onlineCount = userSet.size;
        // 通知房间内所有用户在线状态变化
        this.server.to(roomId).emit('online_status', {
          chatId: chat.id,
          onlineUsers: Array.from(userSet),
          onlineCount,
        });
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
    // 从所有房间的在线用户集合中移除该用户
    this.chatOnlineUsers.forEach((users, roomId) => {
      if (users.delete(userId)) {
        this.server.to(roomId).emit('online_status', {
          chatId: Number(roomId.replace('chat:', '')),
          onlineUsers: Array.from(users),
          onlineCount: users.size,
        });
      }
    });
    this.logger.log(`Client disconnected: ${client.id}, userId: ${userId}`);
  }

  // 添加获取所有聊天室在线状态的方法
  @SubscribeMessage('getOnlineStatus')
  async handleGetOnlineStatus(client: Socket) {
    const userId = client.data.userId;
    const chats = await this.chatService.findAll(userId);

    const statuses = chats.map((chat) => {
      const roomId = `chat:${chat.id}`;
      const userSet = this.chatOnlineUsers.get(roomId) || new Set();

      return {
        chatId: chat.id,
        onlineUsers: Array.from(userSet),
        onlineCount: userSet.size,
      };
    });

    return statuses;
  }
}
