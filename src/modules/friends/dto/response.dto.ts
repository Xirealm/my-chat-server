import { FriendUser } from '../types/friend.types';

export class FriendResponseDto {
  id: number;
  friend: FriendUser;
  createdAt: Date;
}

export class FriendRequestResponseDto {
  id: number;
  requester: FriendUser;
  message?: string;
  createdAt: Date;
}
