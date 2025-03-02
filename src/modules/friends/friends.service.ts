import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFriendRequestDto } from './dto/friend.dto';
import { FriendRequestService } from './services/friend-request.service';
import { FriendOperationException } from './exceptions/friend.exception';
import { FRIEND_ERROR_MESSAGES } from './constants/friend.constants';

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private friendRequestService: FriendRequestService,
  ) {}

  // 修改方法调用
  async sendFriendRequest(
    requesterId: number,
    { receiverId, message }: Omit<CreateFriendRequestDto, 'requesterId'>,
  ) {
    return this.friendRequestService.createFriendRequest(requesterId, {
      receiverId,
      message,
    });
  }

  async acceptFriendRequest(requestId: number, userId: number) {
    await this.findAndValidateRequest(requestId, userId);

    return this.prisma.friend.update({
      where: { id: requestId },
      data: { status: 'accepted' },
      include: {
        requester: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });
  }

  async rejectFriendRequest(requestId: number, userId: number) {
    await this.findAndValidateRequest(requestId, userId);

    return this.prisma.friend.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    });
  }

  async getFriendsList(userId: number) {
    const friends = await this.prisma.friend.findMany({
      where: {
        OR: [
          { requesterId: userId, status: 'accepted' },
          { receiverId: userId, status: 'accepted' },
        ],
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            avatar: true,
            status: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            avatar: true,
            status: true,
          },
        },
      },
    });

    return friends.map((friend) => {
      return friend.requesterId === userId ? friend.receiver : friend.requester;
    });
  }

  async getPendingRequests(userId: number) {
    const [receivedRequests, sentRequests] = await Promise.all([
      this.prisma.friend.findMany({
        where: {
          receiverId: userId,
          status: 'pending',
        },
        include: {
          requester: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.friend.findMany({
        where: {
          requesterId: userId,
          status: 'pending',
        },
        include: {
          receiver: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      received: receivedRequests,
      sent: sentRequests,
    };
  }

  async deleteFriend(userId: number, friendId: number) {
    // 删除双向的好友关系
    await this.prisma.friend.deleteMany({
      where: {
        OR: [
          { requesterId: userId, receiverId: friendId },
          { requesterId: friendId, receiverId: userId },
        ],
        status: 'accepted',
      },
    });

    return { success: true };
  }

  private async findAndValidateRequest(requestId: number, userId: number) {
    const request = await this.prisma.friend.findFirst({
      where: {
        id: requestId,
        receiverId: userId,
        status: 'pending',
      },
    });

    if (!request) {
      throw new FriendOperationException(
        FRIEND_ERROR_MESSAGES.REQUEST_NOT_FOUND,
      );
    }

    return request;
  }
}
