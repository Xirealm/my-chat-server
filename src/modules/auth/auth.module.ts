import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { jwtConfig } from 'src/common/config/jwt.config';

@Module({
  imports: [PrismaModule, JwtModule.register(jwtConfig)],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
