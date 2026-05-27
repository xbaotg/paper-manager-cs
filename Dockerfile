# syntax=docker/dockerfile:1

# ---- deps: install dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: build the Next.js standalone output ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal production image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Datastore lives on a mounted volume; see docker-compose.yml
ENV DATABASE_FILE=/app/data/database.json

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone server + traced node_modules
COPY --from=builder /app/.next/standalone ./
# Static assets are not copied into standalone by default
COPY --from=builder /app/.next/static ./.next/static
# Seed the JSON datastore. On first run, the named volume mounted at
# /app/data inherits this file (and its ownership); later runs reuse it.
COPY --from=builder /app/database.json ./data/database.json

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
