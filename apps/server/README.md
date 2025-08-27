# Серверное приложение

Простой сервер Express с подключением к Redis.

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

Эндпоинт `GET /health` проверяет подключение к Redis и возвращает `{ "status": "ok" }` при успехе.
