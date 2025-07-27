# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Fetch all dependencies to the store (cached layer)
RUN pnpm fetch

# Copy OpenAPI schema for type generation
COPY __schemas__ ./__schemas__

# Install all dependencies from store (including dev deps for build)
RUN pnpm install -r --offline --frozen-lockfile

# Copy source code
COPY . .

# Generate API types
RUN pnpm run gen:api

# Build TypeScript application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Install pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Fetch production dependencies to the store (cached layer)
RUN pnpm fetch --prod

# Install production dependencies from store
RUN pnpm install -r --offline --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy OpenAPI schema (needed at runtime)
COPY --from=builder /app/__schemas__ ./__schemas__

# Install wget for health checks
RUN apk add --no-cache wget

# Create directory for WhatsApp sessions
RUN mkdir -p /app/sessions

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S botuser -u 1001

# Set ownership
RUN chown -R botuser:nodejs /app

USER botuser

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the Node.js application
CMD ["node", "dist/index.js"]