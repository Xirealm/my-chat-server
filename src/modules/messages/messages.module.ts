import { Module } from '@nestjs/common';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { ChatService } from '../chat/chat.service';
import { FilesService } from '../files/files.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    MessagesGateway,
    MessagesService,
    ChatService,
    FilesService,
    WsAuthGuard,
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
