# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY .npmrc ./

# Install dependencies
ARG NPM_TOKEN
ENV NPM_TOKEN=${NPM_TOKEN}
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
COPY .npmrc ./

# Install production dependencies only
ARG NPM_TOKEN
ENV NPM_TOKEN=${NPM_TOKEN}
RUN bun install --production --frozen-lockfile --ignore-scripts

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:3000/").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Start the application
CMD ["bun", "run", "start:prod"]
