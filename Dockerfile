# syntax=docker/dockerfile:1.7

# ─── Stage 1: build ──────────────────────────────────────────
FROM node:22-bookworm-slim AS build

# better-sqlite3 нужны build-инструменты
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG VITE_ADMIN_IDS=""
ARG VITE_ADMIN_HASHES=""
ARG VITE_ADDR_TRC20=""
ARG VITE_ADDR_ERC20=""
ARG VITE_ADDR_BEP20=""
ARG VITE_ADDR_ETH=""
ARG VITE_ADDR_SOL=""
ARG VITE_ADDR_BTC=""
ARG VITE_ADDR_USDC_ETH=""
ARG VITE_ADDR_USDC_SOL=""
ARG VITE_ADDR_TON=""
ENV VITE_ADMIN_IDS=$VITE_ADMIN_IDS
ENV VITE_ADMIN_HASHES=$VITE_ADMIN_HASHES
ENV VITE_ADDR_TRC20=$VITE_ADDR_TRC20
ENV VITE_ADDR_ERC20=$VITE_ADDR_ERC20
ENV VITE_ADDR_BEP20=$VITE_ADDR_BEP20
ENV VITE_ADDR_ETH=$VITE_ADDR_ETH
ENV VITE_ADDR_SOL=$VITE_ADDR_SOL
ENV VITE_ADDR_BTC=$VITE_ADDR_BTC
ENV VITE_ADDR_USDC_ETH=$VITE_ADDR_USDC_ETH
ENV VITE_ADDR_USDC_SOL=$VITE_ADDR_USDC_SOL
ENV VITE_ADDR_TON=$VITE_ADDR_TON

COPY package.json package-lock.json* bun.lock* ./
RUN npm install --no-audit --no-fund

COPY . .

RUN npm run build && npm run server:build

# ─── Stage 2: runtime ────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV SQLITE_DB_PATH=/app/data/orders.db

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/dist/index.js"]
