import {
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Socket } from 'socket.io';
import { SocketGateway } from '../socket/socket.gateway';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/message.dto';
import { WsAuthGuard } from '../socket/guards/ws-auth.guard';
import { ChatService } from '../chat/chat.service';
import { FilesService } from '../files/files.service';

@UseGuards(WsAuthGuard)
export class MessagesGateway extends SocketGateway {
  constructor(
    protected override readonly wsAuthGuard: WsAuthGuard,
    protected override readonly chatService: ChatService,
    private readonly messagesService: MessagesService,
    private readonly filesService: FilesService,
  ) {
    super(wsAuthGuard, chatService);
  }

  // 处理发送消息事件
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ) {
    try {
      const senderId = client.data.userId;

      // 1. 获取聊天室成员
      const members = await this.chatService.getChatMembers(payload.chatId);

      // 2. 保存消息到数据库
      const message = await this.messagesService.createMessage(
        senderId,
        payload,
      );

      // 3. 确保所有成员都订阅了该聊天室
      const roomId = `chat:${payload.chatId}`;
      const connectedClients = await this.server.fetchSockets();

      for (const member of members) {
        // 跳过发送者，因为发送者已经订阅
        if (member.userId === senderId) continue;

        // 查找该成员的socket连接
        const memberSockets = connectedClients.filter(
          (socket) => socket.data.userId === member.userId,
        );

        // 将在线的成员加入房间
        for (const socket of memberSockets) {
          socket.join(roomId);
          this.logger.log(
            `Auto-subscribed client ${socket.id} to chat ${payload.chatId}`,
          );

          // 更新在线用户列表
          let userSet = this.chatOnlineUsers.get(roomId);
          if (!userSet) {
            userSet = new Set<number>();
            this.chatOnlineUsers.set(roomId, userSet);
          }
          userSet.add(member.userId);
        }
      }

      // 4. 广播消息给聊天室所有成员
      this.server.to(roomId).emit('newMessage', {
        ...message,
        chatId: payload.chatId,
      });

      // 5. 广播在线状态更新
      const userSet = this.chatOnlineUsers.get(roomId);
      if (userSet) {
        this.server.to(roomId).emit('online_status', {
          chatId: payload.chatId,
          onlineUsers: Array.from(userSet),
          onlineCount: userSet.size,
        });
      }
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

    // 检查用户是否已经订阅了该聊天室
    const roomId = `chat:${chatId}`;
    const rooms = client.rooms;
    if (rooms.has(roomId)) {
      this.logger.log(
        `Client ${client.id} already subscribed to chat ${chatId}`,
      );
      return { success: true, alreadySubscribed: true };
    }

    // 加入Socket.IO房间
    await client.join(roomId);

    // 更新在线用户状态
    let userSet = this.chatOnlineUsers.get(roomId);
    if (!userSet) {
      userSet = new Set<number>();
      this.chatOnlineUsers.set(roomId, userSet);
    }
    userSet.add(userId);

    // 广播在线状态更新
    this.server.to(roomId).emit('online_status', {
      chatId: chatId,
      onlineUsers: Array.from(userSet),
      onlineCount: userSet.size,
    });

    this.logger.log(`Client ${client.id} subscribed to chat ${chatId}`);
    return { success: true, alreadySubscribed: false };
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

    // 更新在线用户状态
    const userSet = this.chatOnlineUsers.get(roomId);
    if (userSet) {
      userSet.delete(userId);
      // 广播在线状态更新
      this.server.to(roomId).emit('online_status', {
        chatId: chatId,
        onlineUsers: Array.from(userSet),
        onlineCount: userSet.size,
      });
    }

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
