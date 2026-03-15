####################################
# Dockerfile: apps/mqtt-ingestion
# Build context: root of monorepo
####################################
FROM node:20-alpine
WORKDIR /app

COPY . .

RUN npm install

# Generate Prisma client
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

CMD ["node", "apps/mqtt-ingestion/src/index.js"]
