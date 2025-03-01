import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateFriendRequestDto } from '../dto/friend.dto';
import { FriendOperationException } from '../exceptions/friend.exception';
import { FRIEND_ERROR_MESSAGES } from '../constants/friend.constants';

@Injectable()
export class FriendRequestService {
  constructor(private prisma: PrismaService) {}

  async createFriendRequest(
    requesterId: number,
    { receiverId, message }: Omit<CreateFriendRequestDto, 'requesterId'>,
  ) {
    if (requesterId === receiverId) {
      throw new FriendOperationException(FRIEND_ERROR_MESSAGES.CANNOT_ADD_SELF);
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new FriendOperationException(FRIEND_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    const existingRelation = await this.checkExistingRelations(
      requesterId,
      receiverId,
    );

    if (existingRelation) {
      // 如果是被拒绝的请求，更新它而不是创建新的
      if (existingRelation.status === 'rejected') {
        return this.prisma.friend.update({
          where: { id: existingRelation.id },
          data: {
            status: 'pending',
            message,
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
      return existingRelation;
    }

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

    return existingRelation;
  }
}
