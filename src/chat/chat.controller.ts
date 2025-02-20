import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('chats')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async findAll(@Request() req) {
    return this.chatService.findAll(req.user.sub);
  }

  @Post('private')
  async createPrivateChat(@Request() req, @Body() body: { userId: number }) {
    return this.chatService.findOrCreatePrivateChat(req.user.sub, body.userId);
  }

  @Delete(':id')
  async deleteChat(@Param('id') id: string, @Request() req) {
    return this.chatService.deleteChat(parseInt(id, 10), req.user.sub);
  }
}
