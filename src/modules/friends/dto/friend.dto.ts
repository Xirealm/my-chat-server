import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateFriendRequestDto {
  @IsNotEmpty()
  @IsNumber()
  receiverId: number;

  @IsString()
  message: string;
}

export class FriendResponseDto {
  @IsNotEmpty()
  @IsNumber()
  requestId: number;
}
