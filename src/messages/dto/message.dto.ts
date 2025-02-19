import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  receiverId: number;
}

export interface MessageResponse {
  id: number;
  content: string;
  senderId: number;
  receiverId: number;
  createdAt: Date;
  read: boolean;
}
