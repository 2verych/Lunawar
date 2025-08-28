#!/usr/bin/env bash
set -e

REDIS_CONTAINER_NAME="lunawar-redis"

# Ensure Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not installed. Please install Docker to run this script." >&2
  exit 1
fi

# Ensure the Docker daemon is running
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Please start Docker and try again." >&2
  exit 1
fi

# Start Redis in Docker
if ! docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER_NAME}$"; then
  docker run --rm -d -p 6379:6379 --name "$REDIS_CONTAINER_NAME" redis:7-alpine
fi

# Ensure Redis is stopped when the script exits
trap "docker stop $REDIS_CONTAINER_NAME >/dev/null 2>&1" EXIT

# Start the server (development mode)
npm run dev -w @lunawar/server
