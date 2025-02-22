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
  type: string;
  senderId: number;
  chatId: number;
  createdAt: Date;
  fileId: number | null;
  sender: {
    id: number;
    username: string;
    avatar?: string | null;
  };
  file?: {
    id: number;
    filename: string;
    path: string;
    mimetype: string;
    size: number;
    createdAt: Date;
  };
}
