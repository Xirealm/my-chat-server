import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  chatId: number;

  @IsString()
  @IsOptional()
  type?: string = 'text';
}

export interface MessageResponse {
  id: number;
  content: string;
  senderId: number;
  chatId: number;
  createdAt: Date;
  read: boolean;
  type: string;
  chat?: {
    id: number;
    name?: string | null;
    type: string;
  };
}
