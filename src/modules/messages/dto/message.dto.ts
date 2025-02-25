import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class SendMessageDto {
  @IsNumber()
  chatId: number; // 聊天室 ID

  @IsString()
  @IsNotEmpty()
  content: string; // 消息内容
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
