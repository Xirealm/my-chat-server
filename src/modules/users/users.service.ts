import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        phone: true,
        avatar: true,
        status: true,
        lastActiveAt: true,
      },
    });

    return users;
  }

  async findByPhone(phone: string) {
    console.log('phone', phone);
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        username: true,
        avatar: true,
        phone: true,
        status: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }
}
