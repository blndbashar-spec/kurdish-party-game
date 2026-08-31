# ═══════════════════════════════════════════════════
#  Arena API — Dockerfile (multi-stage)
# ═══════════════════════════════════════════════════

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ── runtime ───────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# بەکارهێنەری نەroot
RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle

USER app
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

# سەرەتا migration، پاشان server
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
