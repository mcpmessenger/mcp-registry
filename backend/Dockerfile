# Backend Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy Prisma schema (needed for postinstall script)
COPY prisma ./prisma

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install system dependencies needed for Playwright browsers
# These are required for Chromium to run in Alpine Linux
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    || echo "System dependencies install skipped"

# Copy package files
COPY package*.json ./

# Copy Prisma schema (needed for postinstall script)
COPY --from=builder /app/prisma ./prisma

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist

# Install Playwright browsers for MCP server support
# This is needed for @playwright/mcp to work
# Use npx -y to download Playwright temporarily and install browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright-browsers
RUN npm install -g playwright && \
    npx playwright install chromium --with-deps || echo "Playwright browser install skipped"

# CRITICAL FIX: Ensure entire prisma directory (including migrations) is copied
# This was the root cause - migrations directory was missing
COPY --from=builder /app/prisma ./prisma

# Verify migrations directory exists (fail build if missing)
RUN ls -la /app/prisma/migrations/ || (echo "ERROR: Migrations directory not found!" && exit 1)

# Generate Prisma Client
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Prepare Playwright browsers directory and hand ownership to node user
RUN mkdir -p /ms-playwright-browsers && \
    chown -R nodejs:nodejs /ms-playwright-browsers

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

# Start server
CMD ["node", "dist/server.js"]
