# API_SPEC.md

Вся документация проекта пишется на русском языке.

## Назначение
Этот документ описывает публичные REST и WebSocket контракты для движка браузерной многопользовательской игры. Цель - чтобы фронт и сервер договорились о формате запросов, ответов и событий. Всё ниже про базовый MVP.

---

## Транспорт
- REST для команд и чтения снимков состояния.
- WebSocket для событий реального времени.
- Ответы только JSON.
- Часовой пояс UTC в timestamp.

---

## Аутентификация
- Google OAuth 2.0 на клиенте получает `id_token`.
- Клиент отправляет `POST /auth/google` с `id_token`.
- Сервер проверяет токен, создаёт `sessionId`, кладёт в Redis, выставляет httpOnly cookie.
- Все защищённые эндпоинты требуют валидную cookie.
- Уникальность сессии по email: новый логин инвалидирует старые.

### Профиль
- `GET /me` возвращает текущего пользователя по сессии.

---

## Формат ошибок
```json
{
  "error": {
    "code": "string", 
    "message": "human readable",
    "details": { "any": "optional" }
  },
  "requestId": "uuid"
}
```

Примеры `code`: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMITED`, `CONFLICT`, `INTERNAL`.

---

## Сущности

### User
```json
{
  "uid": "email@example.com",
  "name": "Noname or Display Name"
}
```

### RoomMeta
```json
{
  "id": "room_abc123",
  "size": 4,
  "createdAt": 1712345678901,
  "ttlSec": 1800
}
```

### Message
```json
{
  "messageId": "client-uuid",
  "eventId": 1024,
  "ts": 1712345678901,
  "roomId": "room_abc123",
  "from": { "uid": "email@example.com", "name": "Player" },
  "text": "hello"
}
```

### LobbySnapshot
```json
{
  "users": [
    { "uid": "a@a.com", "name": "Ann" },
    { "uid": "b@b.com", "name": "Bob" }
  ],
  "config": {
    "roomSize": 4,
    "autoMatch": true
  }
}
```

---

## Redis ключи и смысл
- `lobby:queue` список uid в очереди.
- `room:{id}:users` set uid.
- `room:{id}:messages` list последних N сообщений.
- `room:{id}:meta` hash с size, createdAt, ttl.
- `config:roomSize` число.
- `config:autoMatch` boolean.
- `user:{email}:session` текущий sessionId.

---

## REST эндпоинты

### Health
- `GET /health`
- 200:
```json
{ "status": "ok", "epoch": 3, "time": 1712345678901 }
```

### Аутентификация
- `POST /auth/google`
```json
{ "id_token": "google-id-token" }
```
- 200:
```json
{ "user": { "uid": "email@example.com", "name": "Noname or Name" } }
```

- `GET /me`
- 200:
```json
{ "user": { "uid": "email@example.com", "name": "Player" } }
```

### Лобби
- `GET /lobby`
- 200:
```json
{
  "snapshot": {
    "users": [ { "uid": "a@a.com", "name": "Ann" } ],
    "config": { "roomSize": 4, "autoMatch": true }
  }
}
```

- `POST /lobby/join`
```json
{}
```
- 200:
```json
{ "ok": true }
```

- `POST /lobby/leave`
```json
{}
```
- 200:
```json
{ "ok": true }
```

### Комнаты
- `GET /rooms`
- 200:
```json
{
  "rooms": [
    {
      "meta": { "id": "room_abc123", "size": 4, "createdAt": 1712345678901, "ttlSec": 1800 },
      "users": [ { "uid": "a@a.com", "name": "Ann" } ]
    }
  ]
}
```

- `GET /rooms/:roomId`
- 200:
```json
{
  "meta": { "id": "room_abc123", "size": 4, "createdAt": 1712345678901, "ttlSec": 1800 },
  "users": [ { "uid": "a@a.com", "name": "Ann" } ],
  "lastMessages": [
    { "messageId": "m1", "eventId": 100, "ts": 1712345, "roomId": "room_abc123", "from": { "uid": "a@a.com", "name": "Ann" }, "text": "hi" }
  ]
}
```

- `POST /rooms/:roomId/leave`
```json
{}
```
- 200:
```json
{ "ok": true }
```

### Чат
- `POST /rooms/:roomId/chat.send`
```json
{
  "messageId": "client-uuid",
  "text": "Hello, team"
}
```
- 200:
```json
{ "accepted": true }
```

---

## WebSocket

### Контракт
- Endpoint: `/ws`
- После подключения клиент отправляет:
```json
{ "since": { "epoch": 3, "lastEventId": 1017 }, "channels": ["user", "room", "lobby", "admin"] }
```
- Сервер отправляет события по мере их появления в формате:
```json
{
  "eventId": 1018,
  "epoch": 3,
  "ts": 1712345678901,
  "type": "room.user.joined",
  "payload": {
    "roomId": "room_abc123",
    "user": { "uid": "b@b.com", "name": "Bob" }
  }
}
```

### Каналы
- `user`
- `room`
- `lobby`
- `admin`

### Типы событий
- `user.connected`
- `user.disconnected`
- `room.user.joined`
- `room.user.left`
- `chat.message`

---

## Админ API
- `GET /admin/lobby`
```json
{ "snapshot": LobbySnapshot }
```
- `GET /admin/rooms`
```json
{ "rooms": [ { "meta": RoomMeta, "users": [User] } ] }
```
- `POST /admin/room.create`
```json
{ "size": 4 }
```
- `POST /admin/config.set`
```json
{ "roomSize": 4, "autoMatch": true }
```

---

## Валидация и ограничения
- Все текстовые поля в чате до 500 символов.
- `messageId` до 64 символов.
- `roomId` формат `room_[a-z0-9]{6,}`.
- `size` от 2 до 16.

---

## Потоки и сценарии
- Вход через Google OAuth.
- Вступление в лобби.
- Попадание в комнату.
- Работа чата.
- Автоматическое закрытие комнат.

---

## Коды ответов
- 200 успешный ответ.
- 201 создано.
- 400 валидация не прошла.
- 401 нет сессии.
- 403 нет прав.
- 404 не найдено.
- 500 внутренняя ошибка.

---

## Безопасность
- HTTPS.
- HttpOnly + Secure cookie.
- CORS только для доверенных доменов.
- Sanitization сообщений в чате.
