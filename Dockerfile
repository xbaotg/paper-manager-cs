# syntax=docker/dockerfile:1

# ---- deps: install dependencies (better-sqlite3 compiles a native addon) ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
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
# SQLite datastore on the mounted volume; SESSION_SECRET + INITIAL_ADMIN_*
# are provided at runtime via docker-compose (.env), never baked into the image.
ENV DATABASE_FILE=/app/data/app.db

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone server + traced node_modules
COPY --from=builder /app/.next/standalone ./
# Static assets are not copied into standalone by default
COPY --from=builder /app/.next/static ./.next/static
# better-sqlite3 is a native, externalized package — ensure its compiled addon
# is present (tracing may omit the prebuilt .node binary).
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
# Seed source for first-boot migration. On first run the named volume mounted at
# /app/data inherits this file; lib/seed.ts migrates it into app.db, then it is
# ignored on subsequent boots.
COPY --from=builder /app/database.json ./data/database.json

# Sidecar scripts (DB online-backup). Reuses better-sqlite3 already shipped above.
COPY --from=builder /app/scripts ./scripts

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
