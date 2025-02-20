import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ...existing code...

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
}
