export interface User {
  id: string;
  name: string;
}

export interface RoomMeta {
  id: string;
  name: string;
  users: User[];
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  timestamp: number;
}

export interface LobbySnapshot {
  users: User[];
  rooms: RoomMeta[];
}
