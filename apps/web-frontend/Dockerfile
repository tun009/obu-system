####################################
# Dockerfile: apps/web-frontend
# Multi-stage: build Vite → serve Nginx
# Build context: root of monorepo
####################################

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY . .

RUN npm install

# VITE_* env được embed vào bundle lúc build (không phải runtime)
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN cd apps/web-frontend && npm run build

# Stage 2: Serve bằng Nginx
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/apps/web-frontend/dist /usr/share/nginx/html

# nginx.conf được lấy từ build context (không phải từ stage builder)
COPY apps/web-frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
