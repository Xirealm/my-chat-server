import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtPayload } from '../../auth/auth.type';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  // 验证WebSocket消息的token（获取userId）
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractTokenFromHeader(client);
    if (!token) {
      throw new WsException('Unauthorized');
    }

    try {
      // 验证JWT token
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      // 将用户信息存储到socket实例中,便于后续使用
      client.data.user = payload;
      client.data.userId = payload.sub;
    } catch {
      throw new WsException('Unauthorized');
    }

    return true;
  }

  // 验证WebSocket连接的token（获取userId）
  async handleConnection(client: Socket): Promise<boolean> {
    const token = this.extractTokenFromHeader(client);
    if (!token) {
      throw new WsException('Unauthorized');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data.user = payload;
      client.data.userId = payload.sub;
      return true;
    } catch {
      throw new WsException('Unauthorized');
    }
  }

  // 从请求头中提取token
  private extractTokenFromHeader(client: Socket): string | undefined {
    // 支持两种方式传递token
    const [type, token] = client.handshake.auth.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : client.handshake.auth.Authorization;
  }
}
