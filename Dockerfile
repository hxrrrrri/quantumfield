# ============================================================
# QuantumField — Multi-stage Docker build
# ============================================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g bun@1.2
COPY package.json ./
RUN bun install --frozen-lockfile

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g bun@1.2
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g bun@1.2
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
