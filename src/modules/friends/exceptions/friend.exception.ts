import { HttpException, HttpStatus } from '@nestjs/common';

export class FriendOperationException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
