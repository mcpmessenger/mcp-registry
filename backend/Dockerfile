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
# Mesa packages provide software rendering support for headless GPU operations
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    mesa-dri-gallium \
    mesa-gl \
    libx11 \
    libxcomposite \
    libxdamage \
    libxfixes \
    libxrandr \
    libxrender \
    libxshmfence \
    libgbm \
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
# On Alpine, we use the system Chromium installed above and configure Playwright to use it
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright-browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install -g playwright

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
# Playwright expects browsers in ~/.cache/ms-playwright/chromium-<version>/chrome-linux/chrome
# We'll create this structure and symlink to system Chromium
RUN mkdir -p /ms-playwright-browsers && \
    mkdir -p /home/node/.cache/ms-playwright && \
    chown -R nodejs:nodejs /ms-playwright-browsers && \
    chown -R nodejs:nodejs /home/node/.cache

# Create Playwright browser directory structure and symlink to system Chromium
# Playwright looks for browsers in ~/.cache/ms-playwright/chromium-<version>/chrome-linux/chrome
# We create a version directory (using "system" as version) and symlink to system Chromium
# Also create /opt/google/chrome/chrome symlink for compatibility
RUN PLAYWRIGHT_DIR="/home/node/.cache/ms-playwright/chromium-system/chrome-linux" && \
    mkdir -p "$PLAYWRIGHT_DIR" && \
    mkdir -p /opt/google/chrome && \
    if [ -f /usr/bin/chromium-browser ]; then \
      ln -sf /usr/bin/chromium-browser "$PLAYWRIGHT_DIR/chrome" && \
      ln -sf /usr/bin/chromium-browser /opt/google/chrome/chrome && \
      echo "Created symlinks: /usr/bin/chromium-browser -> $PLAYWRIGHT_DIR/chrome and /opt/google/chrome/chrome"; \
    elif [ -f /usr/bin/chromium ]; then \
      ln -sf /usr/bin/chromium "$PLAYWRIGHT_DIR/chrome" && \
      ln -sf /usr/bin/chromium /opt/google/chrome/chrome && \
      echo "Created symlinks: /usr/bin/chromium -> $PLAYWRIGHT_DIR/chrome and /opt/google/chrome/chrome"; \
    else \
      echo "Warning: Chromium not found at expected locations"; \
    fi && \
    chown -R nodejs:nodejs /home/node/.cache && \
    chown -R nodejs:nodejs /opt/google/chrome

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
