// import {
//   SubscribeMessage,
//   ConnectedSocket,
//   MessageBody,
//   WsException,
// } from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
// import { Socket } from 'socket.io';
import { SocketGateway } from '../socket/socket.gateway';
import { WsAuthGuard } from '../socket/guards/ws-auth.guard';
import { ChatService } from './chat.service';

@UseGuards(WsAuthGuard)
export class ChatGateway extends SocketGateway {
  constructor(
    protected override readonly wsAuthGuard: WsAuthGuard,
    protected override readonly chatService: ChatService,
  ) {
    super(wsAuthGuard, chatService);
  }
  async notifyNewChat(chat: any, userIds: number[]) {
    const connectedClients = await this.server.fetchSockets();
    userIds.forEach((userId) => {
      connectedClients.forEach((socket) => {
        if (socket.data.userId === userId) {
          socket.emit('newChat', chat.chatId);
        }
      });
    });
  }
  async notifyGroupNewChat(chat: any, userIds: number[]) {
    const connectedClients = await this.server.fetchSockets();
    userIds.forEach((userId) => {
      connectedClients.forEach((socket) => {
        if (socket.data.userId === userId) {
          socket.emit('newChat', chat.id);
        }
      });
    });
  }
}
