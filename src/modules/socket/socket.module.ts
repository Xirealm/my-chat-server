import { Module, forwardRef } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [forwardRef(() => ChatModule)],
  providers: [
    SocketGateway,
    SocketService,
    WsAuthGuard,
    {
      provide: 'SOCKET_GATEWAY',
      useExisting: SocketGateway,
    },
  ],
  exports: [SocketService], // 只需要导出 SocketService
})
export class SocketModule {}
