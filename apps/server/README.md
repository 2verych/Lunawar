# Серверное приложение

Сервер Express с авторизацией через Google OAuth и хранением состояния в Redis.

## Скрипты

Запуск из корня репозитория с использованием npm workspaces:

- `npm run dev -w @lunawar/server` — запускает сервер разработки с nodemon
- `npm run build -w @lunawar/server` — компилирует TypeScript в `dist`
- `npm run start -w @lunawar/server` — запускает скомпилированный JavaScript

## Окружение

Сервер читает конфигурацию из `.env` в корне репозитория. Создайте файл на основе `.env.example`:

```bash
cp .env.example .env
```

Задайте `PORT` и `REDIS_URL` в соответствии с вашим окружением.

Для OAuth необходимы переменные `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` и `GOOGLE_REDIRECT_URI`.

Эндпоинт `GET /health` проверяет подключение к Redis и возвращает `{ "status": "ok" }` при успехе.

## Аутентификация

- `POST /auth/google` — принимает `id_token`, проверяет его через Google API, создаёт сессию и устанавливает httpOnly cookie.
- `GET /me` — возвращает текущего пользователя по валидной cookie.

## WebSocket

- Точка подключения: `ws://<host>/ws`.
- При подключении клиент отправляет JSON с перечнем каналов и, опционально, параметром `since`.
- Сервер рассылает события в формате `{ eventId, epoch, ts, type, payload }` всем подписанным соединениям.
