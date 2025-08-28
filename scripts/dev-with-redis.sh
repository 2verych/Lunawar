#!/usr/bin/env bash
set -e

REDIS_CONTAINER_NAME="lunawar-redis"

# Start Redis in Docker
if ! docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER_NAME}$"; then
  docker run --rm -d -p 6379:6379 --name "$REDIS_CONTAINER_NAME" redis:7-alpine
fi

# Ensure Redis is stopped when the script exits
trap "docker stop $REDIS_CONTAINER_NAME >/dev/null 2>&1" EXIT

# Start the server (development mode)
npm run dev -w @lunawar/server
