# ─────────────────────────────────────────────────────────────────────────────
# Colyseus v0.17 Server — Multi-stage Docker Build
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build TypeScript
# Stage 2: Minimal production image
# ─────────────────────────────────────────────────────────────────────────────

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source & config
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npx tsc

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S colyseus && \
    adduser -S colyseus -u 1001 -G colyseus

USER colyseus

# Expose Colyseus port
EXPOSE 2567

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:2567/health || exit 1

# Start the server
CMD ["node", "dist/app.config.js"]
