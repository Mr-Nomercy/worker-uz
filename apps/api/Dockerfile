# ==========================================
# Build Stage
# ==========================================
FROM node:22-bullseye-slim AS builder

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ==========================================
# Runtime Stage
# ==========================================
FROM node:22-bullseye-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update && apt-get install -y \
    openssl \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

ARG BUILD_TIMESTAMP
ARG GIT_COMMIT
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV GIT_COMMIT=${GIT_COMMIT}

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

RUN chown -R node:node /usr/src/app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health/live || exit 1

CMD ["node", "dist/main.js"]