# MCP Registry Deployment Guide

Complete guide for deploying the MCP Registry stack to production.

## 📋 Architecture Overview

The MCP Registry consists of:

1. **Frontend** (Next.js) - Port 3000
2. **Backend API** (Express/Node.js) - Port 3001
3. **Database** (PostgreSQL recommended for production)
4. **Kafka** (for async event processing) - Port 9092
5. **Zookeeper** (required for Kafka) - Port 2181

## 🏗️ Deployment Options

### Option 1: Docker Compose (Recommended for Single Server)

Best for: Small to medium deployments, single server, easy setup

#### Architecture
```
┌─────────────────────────────────────────┐
│         Docker Compose Stack            │
├─────────────────────────────────────────┤
│  Frontend (Next.js)  :3000             │
│  Backend API         :3001             │
│  PostgreSQL          :5432             │
│  Kafka               :9092             │
│  Zookeeper           :2181             │
└─────────────────────────────────────────┘
```

#### Setup

1. **Create `docker-compose.yml`:**

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: mcp_registry
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: mcp_registry
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcp_registry"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Zookeeper (for Kafka)
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  # Kafka
  kafka:
    image: confluentinc/cp-kafka:7.4.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_started
    environment:
      DATABASE_URL: postgresql://mcp_registry:${DB_PASSWORD}@postgres:5432/mcp_registry
      PORT: 3001
      NODE_ENV: production
      CORS_ORIGIN: ${FRONTEND_URL}
      KAFKA_BROKERS: kafka:9092
      GOOGLE_GEMINI_API_KEY: ${GOOGLE_GEMINI_API_KEY}
      GOOGLE_VISION_API_KEY: ${GOOGLE_VISION_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GOOGLE_OAUTH_CLIENT_ID: ${GOOGLE_OAUTH_CLIENT_ID}
      GOOGLE_OAUTH_CLIENT_SECRET: ${GOOGLE_OAUTH_CLIENT_SECRET}
      GOOGLE_OAUTH_REDIRECT_URI: ${GOOGLE_OAUTH_REDIRECT_URI}
    ports:
      - "3001:3001"
    command: >
      sh -c "
        npm run migrate:deploy &&
        npm start
      "
    restart: unless-stopped

  # Frontend (Next.js)
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_API_URL: ${BACKEND_URL}
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  postgres_data:
```

2. **Create `backend/Dockerfile`:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/server.js"]
```

3. **Create `Dockerfile.frontend`:**

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build Next.js app
RUN pnpm build

# Production image
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
```

4. **Create `.env` file:**

```env
# Database
DB_PASSWORD=your_secure_password_here

# URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# API Keys
GOOGLE_GEMINI_API_KEY=your_key
GOOGLE_VISION_API_KEY=your_key
OPENAI_API_KEY=your_key

# OAuth
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_secret
GOOGLE_OAUTH_REDIRECT_URI=https://api.yourdomain.com/api/auth/google/callback
```

5. **Deploy:**

```bash
docker-compose up -d
```

---

### Option 2: Cloud Platform Deployment

#### 2.1 Vercel (Frontend) + Railway/Render (Backend)

**Frontend on Vercel:**

1. Connect GitHub repository
2. Set build command: `pnpm build`
3. Set output directory: `.next`
4. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-backend.com`

**Backend on Railway/Render:**

1. Connect GitHub repository
2. Set build command: `cd backend && npm install && npm run build`
3. Set start command: `cd backend && npm run migrate:deploy && npm start`
4. Add environment variables (see below)
5. Add PostgreSQL database addon
6. Add Kafka (or use managed Kafka service)

#### 2.2 AWS Deployment

**Architecture:**
```
┌─────────────────────────────────────────┐
│  CloudFront / S3 (Frontend)           │
│  ALB → ECS Fargate (Backend)          │
│  RDS PostgreSQL                        │
│  MSK (Managed Kafka)                   │
└─────────────────────────────────────────┘
```

**Steps:**

1. **Frontend:**
   - Build: `pnpm build`
   - Deploy to S3 + CloudFront
   - Or use Amplify

2. **Backend:**
   - Create ECS Task Definition
   - Use Fargate launch type
   - Connect to RDS PostgreSQL
   - Connect to MSK Kafka

3. **Database:**
   - Create RDS PostgreSQL instance
   - Run migrations: `npm run migrate:deploy`

4. **Kafka:**
   - Create MSK cluster
   - Update `KAFKA_BROKERS` environment variable

#### 2.3 Google Cloud Platform (GCP)

**Architecture:**
```
┌─────────────────────────────────────────┐
│  Cloud Run (Frontend + Backend)        │
│  Cloud SQL (PostgreSQL)                 │
│  Confluent Cloud (Kafka)                │
└─────────────────────────────────────────┘
```

**Steps:**

1. **Build containers:**
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/mcp-registry-backend
   gcloud builds submit --tag gcr.io/PROJECT_ID/mcp-registry-frontend
   ```

2. **Deploy to Cloud Run:**
   ```bash
   # Backend
   gcloud run deploy mcp-registry-backend \
     --image gcr.io/PROJECT_ID/mcp-registry-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated

   # Frontend
   gcloud run deploy mcp-registry-frontend \
     --image gcr.io/PROJECT_ID/mcp-registry-frontend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

3. **Create Cloud SQL:**
   ```bash
   gcloud sql instances create mcp-registry-db \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro \
     --region=us-central1
   ```

---

### Option 3: Kubernetes

**Architecture:**
```
┌─────────────────────────────────────────┐
│  Ingress (nginx)                        │
│  ├── Frontend Service (Next.js)         │
│  └── Backend Service (Express)          │
│  PostgreSQL (StatefulSet)               │
│  Kafka + Zookeeper (StatefulSets)       │
└─────────────────────────────────────────┘
```

**Kubernetes Manifests:**

See `k8s/` directory for complete manifests.

---

## 🔐 Environment Variables

### Backend Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/mcp_registry

# Server
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# Google APIs
GOOGLE_GEMINI_API_KEY=your_key
GOOGLE_VISION_API_KEY=your_key
GEMINI_MODEL_NAME=gemini-2.5-flash

# OAuth
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_secret
GOOGLE_OAUTH_REDIRECT_URI=https://api.yourdomain.com/api/auth/google/callback

# Kafka
KAFKA_BROKERS=kafka1:9092,kafka2:9092
KAFKA_CLIENT_ID=mcp-registry-api-gateway
KAFKA_GROUP_ID=mcp-registry-workers
KAFKA_TOPIC_DESIGN_REQUESTS=design-requests
KAFKA_TOPIC_DESIGN_READY=design-ready

# OpenAI
OPENAI_API_KEY=your_key
```

### Frontend Environment Variables

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 📦 Pre-Deployment Checklist

### Database Setup

- [ ] Create PostgreSQL database
- [ ] Run migrations: `npm run migrate:deploy`
- [ ] Seed initial data (optional): `npm run seed`

### Kafka Setup

- [ ] Start Kafka cluster
- [ ] Create topics:
  ```bash
  kafka-topics.sh --create --topic design-requests --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
  kafka-topics.sh --create --topic design-ready --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
  ```

### Security

- [ ] Set strong database password
- [ ] Use environment variables for secrets (never commit)
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable authentication (OAuth)

### Monitoring

- [ ] Set up logging (Winston/Pino)
- [ ] Configure health checks
- [ ] Set up error tracking (Sentry)
- [ ] Monitor Kafka lag
- [ ] Set up database backups

---

## 🚀 Deployment Steps

### Step 1: Build

**Backend:**
```bash
cd backend
npm install
npm run build
```

**Frontend:**
```bash
pnpm install
pnpm build
```

### Step 2: Database Migration

```bash
cd backend
npm run migrate:deploy
```

### Step 3: Deploy

**Docker Compose:**
```bash
docker-compose up -d
```

**Cloud Platform:**
Follow platform-specific deployment steps above.

### Step 4: Verify

1. **Health Check:**
   ```bash
   curl https://api.yourdomain.com/health
   ```

2. **API Test:**
   ```bash
   curl https://api.yourdomain.com/v0.1/servers
   ```

3. **Frontend:**
   Visit `https://yourdomain.com` and verify it loads.

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: |
          cd backend
          npm ci
          npm run build
          npm run migrate:deploy
      - name: Deploy to production
        run: |
          # Your deployment command here

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - run: |
          pnpm install
          pnpm build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

---

## 📊 Production Considerations

### Scaling

- **Frontend:** Stateless, scale horizontally
- **Backend:** Stateless API, scale horizontally
- **Database:** Use connection pooling (PgBouncer)
- **Kafka:** Use managed Kafka (MSK, Confluent Cloud) for production

### Performance

- Enable CDN for frontend assets
- Use Redis for caching
- Implement database query optimization
- Set up load balancing

### Reliability

- Database backups (automated)
- Health checks and auto-restart
- Graceful shutdown handling
- Circuit breakers for external APIs

### Security

- HTTPS/TLS everywhere
- Rate limiting
- Input validation
- SQL injection prevention (Prisma handles this)
- CORS configuration
- Secrets management (AWS Secrets Manager, etc.)

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL

# Check migrations
cd backend
npx prisma migrate status
```

### Kafka Connection Issues

```bash
# Test Kafka
kafka-topics.sh --list --bootstrap-server localhost:9092

# Check consumer lag
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group mcp-registry-workers
```

### Backend Won't Start

1. Check environment variables
2. Verify database is accessible
3. Check Kafka is running
4. Review logs: `docker-compose logs backend`

---

## 📚 Additional Resources

- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Kafka Production Checklist](https://kafka.apache.org/documentation/#production)
- [Docker Compose Production](https://docs.docker.com/compose/production/)

---

## 🎯 Quick Start (Production)

```bash
# 1. Clone repository
git clone https://github.com/your-org/mcp-registry.git
cd mcp-registry

# 2. Set environment variables
cp backend/env.example.txt backend/.env
# Edit backend/.env with your values

# 3. Start services
docker-compose up -d

# 4. Run migrations
docker-compose exec backend npm run migrate:deploy

# 5. Verify
curl http://localhost:3001/health
```

---

**Status:** ✅ Production-ready deployment guide
