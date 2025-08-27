# Roadmap
Выполненные пункты отмечаются префиксом [DONE], пропущенные — [SKIP].

- [DONE] Документация: технический план (README) и спецификация API
- [ ] Структура монорепозитория: apps/, packages/, infra/ и .env.example
- [SKIP] Docker Compose инфраструктура и Makefile
- [DONE] Общие сущности и схема ключей Redis в packages/shared
- [DONE] Каркас сервера на Node.js + Express, Redis и /health
- [ ] Авторизация через Google OAuth и управление сессиями
- [ ] WebSocket API
- [ ] Лобби и комнаты: очередь, автоматическое/ручное создание, хранение в Redis
- [ ] Чат: отправка сообщений, mini/full UI
- [ ] Админка на React: lobby, rooms, config
- [ ] Клиент для игроков на React: landing, lobby, room
- [DONE] Локализация и словарь en.json
- [ ] Деплой: Docker-образы и Nginx reverse proxy
- [ ] Критерии MVP: Google auth, автолобби, админ создание комнат, чат, закрытие пустых комнат, WebSocket, настройки
