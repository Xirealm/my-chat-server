import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ phone: dto.phone }, { username: dto.username }] },
    });

    if (existingUser) {
      throw new ConflictException('用户名或手机号已存在');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        phone: dto.phone,
        password: hashedPassword,
      },
    });

    const token = await this.generateToken(user.id);
    return { token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'online', lastActiveAt: new Date() },
    });

    const token = await this.generateToken(user.id);

    return {
      token,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        avatar: updatedUser.avatar,
        phone: updatedUser.phone,
        status: updatedUser.status,
      },
    };
  }

  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'offline', lastActiveAt: new Date() },
    });
    return { message: '登出成功' };
  }

  private async generateToken(userId: number): Promise<string> {
    return this.jwtService.signAsync({ sub: userId });
  }
}
