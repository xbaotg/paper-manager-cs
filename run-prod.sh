#!/usr/bin/env bash
# Host the production standalone build. Reads env from .env.local.
cd "$(dirname "$0")"
set -a; . ./.env.local; set +a
exec node .next/standalone/server.js
