export const USERS_SET = 'users';
export const ROOMS_SET = 'rooms';
export const LOBBY_QUEUE = 'lobby:queue';

export const CONFIG_ROOM_SIZE = 'config:roomSize';
export const CONFIG_AUTO_MATCH = 'config:autoMatch';

export const userKey = (id: string) => `user:${id}`;
export const roomKey = (id: string) => `room:${id}`;
export const roomMessagesKey = (id: string) => `room:${id}:messages`;
export const roomUsersKey = (id: string) => `room:${id}:users`;
export const roomMetaKey = (id: string) => `room:${id}:meta`;
