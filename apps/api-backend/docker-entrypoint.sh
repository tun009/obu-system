#!/bin/sh
# Entrypoint cho api-backend container
# Đợi PostgreSQL sẵn sàng → push Prisma schema → start server

set -e

echo "[Entrypoint] Waiting for PostgreSQL..."
until npx prisma db push --schema=packages/database/prisma/schema.prisma --skip-generate; do
  echo "[Entrypoint] DB not ready, retrying in 3s..."
  sleep 3
done

echo "[Entrypoint] DB schema ready. Starting API server..."
exec node apps/api-backend/src/index.js
