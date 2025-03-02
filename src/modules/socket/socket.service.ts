import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { SocketGateway } from './socket.gateway';

@Injectable()
export class SocketService {
  private server: Server;

  constructor(private socketGateway: SocketGateway) {
    this.server = this.socketGateway.getServer();
  }

  getServer(): Server {
    return this.server;
  }

  async joinRoom(userId: number, roomId: string) {
    const sockets = await this.server.fetchSockets();
    for (const socket of sockets) {
      if (socket.data.userId === userId) {
        socket.join(roomId);
      }
    }
  }

  emitToRoom(roomId: string, event: string, data: any) {
    this.server.to(roomId).emit(event, data);
  }
}
