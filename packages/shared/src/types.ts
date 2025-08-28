export interface User {
  uid: string;
  name: string;
}

export interface RoomMeta {
  id: string;
  size: number;
  createdAt: number;
  ttlSec: number;
}

export interface RoomInfo {
  meta: RoomMeta;
  users: User[];
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  timestamp: number;
}

export interface LobbyConfig {
  roomSize: number;
  autoMatch: boolean;
}

export interface LobbySnapshot {
  users: User[];
  config: LobbyConfig;
}
