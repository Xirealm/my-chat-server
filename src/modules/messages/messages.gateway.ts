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
import { FilesService } from '../files/files.service';

@WebSocketGateway({
  cors: { origin: true }, // 允许跨域
  namespace: '/chat', // 命名空间
  // WebSocket 配置
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

  // 处理发送消息事件
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ) {
    try {
      const senderId = client.data.userId;
      // 1. 保存消息到数据库
      const message = await this.messagesService.createMessage(
        senderId,
        payload,
      );
      // 2. 广播消息给聊天室所有成员
      const roomId = `chat:${payload.chatId}`;
      this.server.to(roomId).emit('newMessage', {
        ...message,
        chatId: payload.chatId,
      });
    } catch (error) {
      throw new WsException(error.message);
    }
  }

  // 普通文件上传(已废弃)
  // @SubscribeMessage('uploadFile')
  // async handleFileUpload(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody()
  //   payload: {
  //     file: ArrayBuffer;
  //     filename: string;
  //     mimetype: string;
  //     chatId: number;
  //   },
  // ) {
  //   try {
  //     const uploaderId = client.data.userId;
  //     const buffer = Buffer.from(payload.file);
  //     const size = buffer.length;
  //     // 保存文件
  //     const fileInfo = await this.filesService.saveFile({
  //       filename: payload.filename,
  //       mimetype: payload.mimetype,
  //       size,
  //       buffer,
  //       uploaderId,
  //     });

  //     // 创建文件类型的消息
  //     const message = await this.messagesService.createFileMessage({
  //       senderId: uploaderId,
  //       chatId: payload.chatId,
  //       type: 'file',
  //       content: fileInfo.filename,
  //       fileId: fileInfo.id, // 使用 fileId 替代 fileUrl
  //     });

  //     // 广播文件消息到聊天室
  //     const roomId = `chat:${payload.chatId}`;
  //     this.server.to(roomId).emit('newMessage', message);

  //     return { success: true, message };
  //   } catch (error) {
  //     this.logger.error(`File upload error: ${error.message}`);
  //     throw new WsException('File upload failed');
  //   }
  // }

  // 分片上传大文件
  @SubscribeMessage('uploadFileChunk')
  async handleFileChunkUpload(
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
      // 保存单个文件分片
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

  // 合并文件分片
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
      // 合并文件分片
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

  // 订阅聊天室
  @SubscribeMessage('subscribeToChat')
  async handleSubscribeToChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatId: number,
  ) {
    const userId = client.data.userId;

    // 验证用户是否加入聊天室
    const members = await this.chatService.getChatMembers(chatId);
    const isMember = members.some((member) => member.userId === userId);

    if (!isMember) {
      throw new WsException('Unauthorized to join this chat');
    }

    // 加入Socket.IO房间
    const roomId = `chat:${chatId}`;
    await client.join(roomId);
    this.logger.log(`Client ${client.id} subscribed to chat ${chatId}`);

    return { success: true };
  }

  // 取消订阅聊天室
  @SubscribeMessage('unsubscribeFromChat')
  async handleUnsubscribeFromChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatId: number,
  ) {
    const userId = client.data.userId;
    // 验证用户是否加入聊天室
    const members = await this.chatService.getChatMembers(chatId);
    const isMember = members.some((member) => member.userId === userId);

    if (!isMember) {
      throw new WsException('Unauthorized to join this chat');
    }
    const roomId = `chat:${chatId}`;
    await client.leave(roomId);
    this.logger.log(`Client ${client.id} unsubscribed from chat ${chatId}`);
    return { success: true };
  }

  // 获取聊天室历史消息（短暂）
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
