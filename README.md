# OBU Fleet Tracker System

A real-time vehicle fleet monitoring system built with a **Monorepo (Turborepo)** architecture. The stack includes React + Vite for the frontend, and Node.js, Express, Socket.io, MQTT, Redis, and PostgreSQL (with PostGIS) for the backend.

## Architecture

```
obu-system/
├── apps/
│   ├── mqtt-ingestion   # MQTT listener → processes OBU payloads → writes to DB & Redis
│   ├── api-backend      # REST API + WebSocket hub + CRON watchdog
│   └── web-frontend     # React SPA with real-time map & vehicle management
└── packages/
    └── database         # Shared Prisma client & schema (PostgreSQL + PostGIS)
```

## Prerequisites

- **Node.js** >= 18.x
- **Docker & Docker Compose** (for PostgreSQL + PostGIS and Redis)

## Quick Start

### 1. Start Infrastructure (Database & Redis)

```bash
docker-compose up -d
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Sync Database Schema (Prisma)

```bash
npx prisma db push --schema=packages/database/prisma/schema.prisma
```

### 4. Run All Services

Turborepo runs all 3 services in parallel with a single command:

```bash
npm run dev
```

This starts `mqtt-ingestion`, `api-backend`, and `web-frontend` concurrently.

## Access

Once running, open your browser at: **http://localhost:8080**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS, Leaflet, Socket.io Client |
| API | Node.js, Express, Socket.io, Prisma |
| Ingestion | MQTT.js, Redis Pub/Sub |
| Database | PostgreSQL + PostGIS |
| Cache | Redis |
| DevOps | Docker, Turborepo |
