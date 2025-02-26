export type FriendStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendUser {
  id: number;
  username: string;
  avatar: string;
  status?: string;
}

export interface FriendRequest {
  id: number;
  requesterId: number;
  receiverId: number;
  message?: string;
  status: FriendStatus;
  createdAt: Date;
  requester?: FriendUser;
  receiver?: FriendUser;
}
