import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class SendMessageDto {
  @IsNumber()
  chatId: number;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export interface MessageResponse {
  id: number;
  content: string;
  senderId: number;
  chatId: number;
  createdAt: Date;
  type: string;
  sender: {
    id: number;
    username: string;
    avatar: string | null;
  };
}
