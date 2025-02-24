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
import { FilesService } from '../files/files.service'; // 添加 FilesService

@WebSocketGateway({
  cors: {
    origin: true,
  },
  namespace: '/chat',
  // 添加 WebSocket 配置
  maxHttpBufferSize: 1e8, // 100MB
  pingTimeout: 60000, // 60秒
  pingInterval: 25000, // 25秒
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
    private filesService: FilesService, // 添加 FilesService
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

  @SubscribeMessage('uploadFile')
  async handleFileUpload(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      file: ArrayBuffer;
      filename: string;
      mimetype: string; // 添加 mimetype
      chatId: number;
    },
  ) {
    try {
      const uploaderId = client.data.userId;
      const buffer = Buffer.from(payload.file);
      const size = buffer.length;
      // 保存文件
      const fileInfo = await this.filesService.saveFile({
        filename: payload.filename,
        mimetype: payload.mimetype,
        size,
        buffer,
        uploaderId,
      });

      // 创建文件消息
      const message = await this.messagesService.createFileMessage({
        senderId: uploaderId,
        chatId: payload.chatId,
        type: 'file',
        content: fileInfo.filename,
        fileId: fileInfo.id, // 使用 fileId 替代 fileUrl
      });

      // 广播消息到聊天室
      const roomId = `chat:${payload.chatId}`;
      this.server.to(roomId).emit('newMessage', message);

      return { success: true, message };
    } catch (error) {
      this.logger.error(`File upload error: ${error.message}`);
      throw new WsException('File upload failed');
    }
  }

  @SubscribeMessage('uploadFileChunk')
  async handleFileChunkUpload(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      chunk: ArrayBuffer;
      chunkIndex: number;
      totalChunks: number;
      fileId: string;
    },
  ) {
    try {
      const buffer = Buffer.from(payload.chunk);
      await this.filesService.saveFileChunk({
        chunk: buffer,
        chunkIndex: payload.chunkIndex,
        totalChunks: payload.totalChunks,
        fileId: payload.fileId,
      });

      return { success: true, chunkIndex: payload.chunkIndex };
    } catch (error) {
      this.logger.error(`Chunk upload error: ${error.message}`);
      throw new WsException('Chunk upload failed');
    }
  }

  @SubscribeMessage('mergeFileChunks')
  async handleFileMerge(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      fileId: string;
      filename: string;
      totalChunks: number;
      mimetype: string;
      size: number;
      chatId: number;
    },
  ) {
    try {
      const uploaderId = client.data.userId;
      const fileInfo = await this.filesService.mergeFileChunks({
        fileId: payload.fileId,
        filename: payload.filename,
        totalChunks: payload.totalChunks,
        mimetype: payload.mimetype,
        size: payload.size,
        uploaderId,
      });

      // 创建文件消息
      const message = await this.messagesService.createFileMessage({
        senderId: uploaderId,
        chatId: payload.chatId,
        type: 'file',
        content: fileInfo.filename,
        fileId: fileInfo.id,
      });

      // 广播消息
      const roomId = `chat:${payload.chatId}`;
      this.server.to(roomId).emit('newMessage', message);

      return { success: true, message };
    } catch (error) {
      this.logger.error(`File merge error: ${error.message}`);
      throw new WsException('File merge failed');
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
