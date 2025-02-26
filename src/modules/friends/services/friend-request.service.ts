import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateFriendRequestDto } from '../dto/friend.dto';
import { FriendOperationException } from '../exceptions/friend.exception';
import { FRIEND_ERROR_MESSAGES } from '../constants/friend.constants';

@Injectable()
export class FriendRequestService {
  constructor(private prisma: PrismaService) {}

  // 修改方法签名，requesterId作为独立参数
  async createFriendRequest(
    requesterId: number,
    { receiverId, message }: Omit<CreateFriendRequestDto, 'requesterId'>,
  ) {
    if (requesterId === receiverId) {
      throw new FriendOperationException(FRIEND_ERROR_MESSAGES.CANNOT_ADD_SELF);
    }

    // 检查接收者是否存在
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new FriendOperationException(FRIEND_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    await this.checkExistingRelations(requesterId, receiverId);

    return this.prisma.friend.create({
      data: {
        requesterId,
        receiverId,
        message,
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
    });
  }

  private async checkExistingRelations(
    requesterId: number,
    receiverId: number,
  ) {
    const existingRelation = await this.prisma.friend.findFirst({
      where: {
        OR: [
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId },
        ],
      },
    });

    if (existingRelation) {
      if (existingRelation.status === 'accepted') {
        throw new FriendOperationException(
          FRIEND_ERROR_MESSAGES.ALREADY_FRIENDS,
        );
      }
      if (existingRelation.status === 'pending') {
        throw new FriendOperationException(
          FRIEND_ERROR_MESSAGES.REQUEST_ALREADY_SENT,
        );
      }
    }
  }
}
