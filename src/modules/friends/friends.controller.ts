import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Request,
  Body,
  Delete,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateFriendRequestDto } from './dto/friend.dto';

@Controller('friends')
@UseGuards(AuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post('request')
  async sendFriendRequest(
    @Request() req,
    @Body() createFriendRequestDto: CreateFriendRequestDto,
  ) {
    return this.friendsService.sendFriendRequest(
      req.user.sub,
      createFriendRequestDto,
    );
  }

  @Post('accept/:requestId')
  async acceptFriendRequest(
    @Request() req,
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.acceptFriendRequest(
      parseInt(requestId),
      req.user.sub,
    );
  }

  @Post('reject/:requestId')
  async rejectFriendRequest(
    @Request() req,
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.rejectFriendRequest(
      parseInt(requestId),
      req.user.sub,
    );
  }

  @Get()
  async getFriendsList(@Request() req) {
    return this.friendsService.getFriendsList(req.user.sub);
  }

  @Get('requests/pending')
  async getPendingRequests(@Request() req) {
    return this.friendsService.getPendingRequests(req.user.sub);
  }

  @Delete(':friendId')
  async deleteFriend(@Request() req, @Param('friendId') friendId: string) {
    return this.friendsService.deleteFriend(req.user.sub, parseInt(friendId));
  }
}
