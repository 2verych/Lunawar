export const USERS_SET = 'users';
export const ROOMS_SET = 'rooms';

export const userKey = (id: string) => `user:${id}`;
export const roomKey = (id: string) => `room:${id}`;
export const roomMessagesKey = (id: string) => `room:${id}:messages`;
