####################################
# Dockerfile: apps/api-backend
# Build context: root of monorepo
####################################
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

# Copy toàn bộ monorepo (node_modules đã bị exclude bởi .dockerignore)
COPY . .

# Cài dependencies (npm workspaces tự resolve đúng)
RUN npm install

# Generate Prisma client (không cần DATABASE_URL, chỉ đọc schema)
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

EXPOSE 5000

# Fix line endings (CRLF → LF) rồi mới chmod - tránh lỗi khi tạo file trên Windows
RUN sed -i 's/\r$//' apps/api-backend/docker-entrypoint.sh \
    && chmod +x apps/api-backend/docker-entrypoint.sh

CMD ["sh", "apps/api-backend/docker-entrypoint.sh"]
