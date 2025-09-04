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
  messageId: string;
  eventId: number;
  ts: number;
  roomId: string;
  from: User;
  text: string;
}

export interface LobbyConfig {
  roomSize: number;
  autoMatch: boolean;
}

export interface LobbySnapshot {
  users: User[];
  config: LobbyConfig;
}
