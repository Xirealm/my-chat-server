import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
  Body,
  Query,
  Res,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Response } from 'express';

@Controller('chats')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}
  // 获取聊天列表
  @Get()
  async findAll(@Request() req) {
    return this.chatService.findAll(req.user.sub);
  }

  // 创建/获取聊天
  @Post('private')
  async createPrivateChat(@Request() req, @Body() body: { userId: number }) {
    const chat = await this.chatService.findOrCreatePrivateChat(
      req.user.sub,
      body.userId,
    );
    await this.chatGateway.notifyNewChat(chat, [req.user.sub, body.userId]);
    return chat;
  }
  @Post('group')
  async createGroupChat(@Request() req, @Body() body: { userIds: number[] }) {
    const chat = await this.chatService.createGroupChat(
      req.user.sub,
      body.userIds,
    );
    await this.chatGateway.notifyGroupNewChat(chat, body.userIds);
    return chat;
  }

  @Delete(':id')
  async deleteChat(@Param('id') id: string, @Request() req) {
    return this.chatService.deleteChat(parseInt(id, 10), req.user.sub);
  }

  @Get(':id/history')
  async getHistoryMessages(
    @Param('id') id: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('keyword') keyword: string,
    @Request() req,
  ) {
    return this.chatService.getHistoryMessages(
      parseInt(id, 10),
      req.user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
      keyword,
    );
  }

  @Get('file/:messageId')
  async downloadFile(
    @Param('messageId') messageId: string,
    @Res() res: Response,
  ) {
    const fileData = await this.chatService.getFileMessage(parseInt(messageId));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${fileData.filename}`,
    );
    res.setHeader('Content-Type', fileData.mimetype);
    res.sendFile(fileData.path);
  }
}
