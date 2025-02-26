import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateFriendRequestDto {
  @IsNotEmpty()
  @IsNumber()
  receiverId: number;

  @IsOptional()
  @IsString()
  message?: string;
}
