# Shared Package

Common types, events, i18n helpers and Redis key generators shared across the project.

## Types
- `User`
- `RoomMeta`
- `Message`
- `LobbySnapshot`

## Events
- `lobby.joined`
- `room.created`
- `chat.message`

## i18n
- `l(key, fallback)` – looks up `key` in `en.json` and returns `fallback` when missing.

## Redis Keys
- `USERS_SET`
- `ROOMS_SET`
- `userKey(id)`
- `roomKey(id)`
- `roomMessagesKey(id)`
