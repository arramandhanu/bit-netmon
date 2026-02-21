<div align="center">

# 🌐 NetMon — Network Monitoring System

**Enterprise-grade SNMP network monitoring with real-time dashboards, alerting, and RRD-style performance graphs.**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-TimescaleDB-336791?logo=postgresql&logoColor=white)](https://www.timescale.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📸 Screenshots

> _Add screenshots here after deployment_

---

## ✨ Features

| Category | Features |
|----------|----------|
| 📊 **Monitoring** | SNMP v1/v2c/v3 polling, auto-discovery of interfaces, CPU/Memory/Response time tracking |
| 📈 **RRD-Style Graphs** | Classic RRDtool-style performance charts (ECharts), per-interface traffic graphs with In/Out bps |
| 🔔 **Alerting** | Threshold-based alerts, configurable notification channels (Telegram, Email) |
| 🗺️ **Network Map** | Device locations on interactive Leaflet maps |
| 🔐 **Authentication** | JWT-based auth with access & refresh tokens, role-based access |
| ⚡ **Real-time** | WebSocket updates for device status changes |
| 🐳 **Dockerized** | Full Docker Compose setup for development and production |
| 📦 **Monorepo** | Turborepo-managed monorepo with shared packages |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│                   Next.js 14 (port 3001)                    │
│            ECharts · Leaflet · Tailwind CSS                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│                     Backend API                             │
│                  NestJS 10 (port 3000)                      │
│         Prisma ORM · BullMQ · net-snmp · Pino              │
└────────┬─────────────────────┬──────────────────────────────┘
         │                     │
┌────────▼────────┐   ┌───────▼────────┐
│  PostgreSQL 16  │   │    Redis 7     │
│  + TimescaleDB  │   │  (Queue/Cache) │
│   (port 5432)   │   │  (port 6379)   │
└─────────────────┘   └────────────────┘
```

---

## 📁 Project Structure

```
netmon/
├── apps/
│   ├── api/              # NestJS REST API + SNMP poller
│   │   ├── src/
│   │   │   ├── modules/     # Feature modules (devices, metrics, alerts, etc.)
│   │   │   ├── common/      # Guards, interceptors, filters
│   │   │   └── config/      # App configuration
│   │   └── Dockerfile.dev
│   ├── web/              # Next.js frontend dashboard
│   │   ├── src/
│   │   │   ├── app/         # App router pages
│   │   │   ├── components/  # Reusable UI components
│   │   │   └── hooks/       # Custom React hooks
│   │   └── Dockerfile.dev
│   └── bull-board/       # BullMQ dashboard (port 3002)
│       └── Dockerfile.dev
├── packages/
│   ├── database/         # Prisma schema, migrations, seed
│   │   └── prisma/
│   └── shared/           # Shared types, constants, Zod schemas
├── infra/                # Docker Compose configs
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   └── scripts/             # Utility scripts (backup, etc.)
├── tests/                # Test suites
│   ├── e2e/                 # Playwright E2E tests
│   ├── integration/         # Integration tests
│   └── k6/                  # Load tests
├── .github/workflows/    # CI/CD pipelines
├── .env.example             # Environment template
├── turbo.json               # Turborepo config
└── package.json             # Root workspace config
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Required |
|------|---------|----------|
| **Node.js** | ≥ 20.x | Yes |
| **npm** | ≥ 10.x | Yes |
| **Docker** & **Docker Compose** | Latest | Yes |
| **Git** | Latest | Yes |

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/netmon.git
cd netmon
```

### 2️⃣ Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and customize the values — especially for production:

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL username | `netmon` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `<YOUR_PASSWORD>` |
| `POSTGRES_DB` | Database name | `netmon` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `DATABASE_URL` | Full connection string | _(auto-composed)_ |
| `REDIS_HOST` | Redis hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT signing secret (min 64 chars) | _(change this!)_ |
| `ENCRYPTION_KEY` | Encryption key for SNMP credentials | _(change this!)_ |
| `API_PORT` | Backend API port | `3000` |
| `WEB_PORT` | Frontend port | `3001` |
| `NEXT_PUBLIC_API_URL` | API URL for frontend | `http://localhost:3000/api/v1` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `http://localhost:3000` |

> [!CAUTION]
> **Always change `JWT_SECRET` and `ENCRYPTION_KEY`** before deploying to production!

### 3️⃣ Start Infrastructure

```bash
# Start PostgreSQL (TimescaleDB) + Redis containers
npm run docker:dev
```

### 4️⃣ Install Dependencies

```bash
npm install
```

### 5️⃣ Set Up the Database

```bash
# Run Prisma migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed initial data (admin user, default settings)
npx -w packages/database prisma db seed
```

> [!NOTE]
> The seed script creates an initial admin account. Check `packages/database/prisma/seed.ts` for default credentials.

### 6️⃣ Start Development Servers

```bash
npm run dev
```

This starts **all services** concurrently via Turborepo:

| Service | URL | Description |
|---------|-----|-------------|
| **API** | http://localhost:3000/api/v1 | Backend REST API |
| **Swagger** | http://localhost:3000/api/docs | API documentation |
| **Frontend** | http://localhost:3001 | Web dashboard |
| **BullMQ Board** | http://localhost:3002 | Queue monitoring |
| **Prisma Studio** | `npm run db:studio` | Database explorer |

---

## 🐳 Docker Development (Full Stack)

Run the entire stack inside Docker (no local Node.js needed):

```bash
# Build and start all services
npm run docker:dev:build

# Start without rebuilding
npm run docker:dev

# Stop all services
npm run docker:down
```

### Container Overview

| Container | Image | Port |
|-----------|-------|------|
| `netmon-postgres` | `timescale/timescaledb:2.14.2-pg16` | 5432 |
| `netmon-redis` | `redis:7.2-alpine` | 6379 |
| `netmon-api` | Built from `apps/api/Dockerfile.dev` | 3000 |
| `netmon-web` | Built from `apps/web/Dockerfile.dev` | 3001 |
| `netmon-bull-board` | Built from `apps/bull-board/Dockerfile.dev` | 3002 |

---

## 🔧 Adding Your First Device

1. Open the dashboard at http://localhost:3001
2. Log in with the admin credentials from the seed
3. Navigate to **Devices → Add New Device**
4. Enter the device details:
   - **Hostname**: e.g., `mikrotik-core-01`
   - **IP Address**: e.g., `192.168.1.1`
   - **SNMP Version**: `v2c`
   - **Community String**: e.g., `public`
5. Click **Test Connection** to verify SNMP access
6. Click **Create Device**

The system will automatically start polling the device and collecting metrics.

---

## 📊 Available SNMP Metrics

| Metric | OID/Method | Description |
|--------|-----------|-------------|
| CPU Utilization | `hrProcessorLoad` / vendor MIBs | Processor usage percentage |
| Memory Usage | `hrStorageUsed` / `hrStorageSize` | Memory utilization percentage |
| Response Time | ICMP Ping | Round-trip latency in ms |
| Uptime | `sysUpTime.0` | System uptime since last reboot |
| Interface Traffic | `ifHCInOctets` / `ifHCOutOctets` | Per-interface In/Out bandwidth |
| Interface Status | `ifOperStatus` / `ifAdminStatus` | Link up/down state |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React, Tailwind CSS, ECharts, Leaflet |
| **Backend** | NestJS 10, TypeScript, Prisma 5, BullMQ, Pino |
| **Database** | PostgreSQL 16 + TimescaleDB (time-series) |
| **Cache/Queue** | Redis 7 (BullMQ job queues) |
| **SNMP** | net-snmp (Node.js SNMP library) |
| **Auth** | JWT (access + refresh tokens) |
| **Monorepo** | Turborepo |
| **Containerization** | Docker, Docker Compose |
| **CI/CD** | GitHub Actions |

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all services in development mode |
| `npm run build` | Build all packages |
| `npm run lint` | Lint all packages |
| `npm run test` | Run tests |
| `npm run format` | Format code with Prettier |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm run docker:dev` | Start Docker dev environment |
| `npm run docker:dev:build` | Build & start Docker dev environment |
| `npm run docker:down` | Stop Docker containers |

---

## 🧪 Testing

```bash
# Unit & integration tests
npm run test

# E2E tests (requires running app)
npx playwright test

# Load tests
cd tests/k6
k6 run load-test.js
```

---

## 🚢 Production Deployment

```bash
# Use the production Docker Compose
docker compose --env-file .env -f infra/docker-compose.prod.yml up -d
```

> [!IMPORTANT]
> Before deploying to production:
> - Set `NODE_ENV=production` in `.env`
> - Use strong, unique values for `JWT_SECRET` and `ENCRYPTION_KEY`
> - Configure proper `POSTGRES_PASSWORD`
> - Set up reverse proxy (Nginx/Caddy) with SSL
> - Configure notification channels (Telegram/Email) if needed

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for network engineers**

🌐 NetMon — Monitor Everything, Miss Nothing.

</div>
