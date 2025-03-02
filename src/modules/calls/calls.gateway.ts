import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway()
export class CallsGateway {
  @WebSocketServer()
  server: Server;

  // 处理呼叫请求
  @SubscribeMessage('callUser')
  handleCallUser(
    client: Socket,
    data: { to: string; offer: RTCSessionDescription },
  ) {
    this.server.to(data.to).emit('incomingCall', {
      from: client.id,
      offer: data.offer,
    });
  }

  // 处理应答
  @SubscribeMessage('answerCall')
  handleAnswerCall(
    client: Socket,
    data: { to: string; answer: RTCSessionDescription },
  ) {
    this.server.to(data.to).emit('callAnswered', {
      from: client.id,
      answer: data.answer,
    });
  }

  // 处理ICE候选者
  @SubscribeMessage('iceCandidate')
  handleIceCandidate(
    client: Socket,
    data: { to: string; candidate: RTCIceCandidate },
  ) {
    this.server.to(data.to).emit('iceCandidate', {
      from: client.id,
      candidate: data.candidate,
    });
  }

  // 处理挂断
  @SubscribeMessage('endCall')
  handleEndCall(client: Socket, data: { to: string }) {
    this.server.to(data.to).emit('callEnded', { from: client.id });
  }
}
