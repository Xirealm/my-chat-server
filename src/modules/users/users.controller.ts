import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 搜索所有用户
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  // 根据手机号搜索用户
  @Get('search')
  async findByPhone(@Query('phone') phone: string) {
    return this.usersService.findByPhone(phone);
  }
}
