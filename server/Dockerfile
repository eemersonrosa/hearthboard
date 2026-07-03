# Multi-stage build: compile native deps (better-sqlite3) in a throwaway
# builder, ship a slim alpine runtime. Keeps the image small and light on
# low-power hardware (Pi, thin clients, old laptops).
FROM node:24-alpine AS builder

WORKDIR /app

# Toolchain only exists in this stage.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# ---- Runtime ----
FROM node:24-alpine

WORKDIR /app

ARG PORT=5000
ARG TZ=America/New_York
ARG BACKEND_VERSION=dev
ARG BACKEND_GIT_COMMIT=
ARG BACKEND_GITHUB_REPOSITORY=eemersonrosa/hearthboard

ENV PORT=$PORT \
    TZ=$TZ \
    NODE_ENV=production \
    APP_VERSION=$BACKEND_VERSION \
    BACKEND_VERSION=$BACKEND_VERSION \
    BACKEND_GIT_COMMIT=$BACKEND_GIT_COMMIT \
    BACKEND_GITHUB_REPOSITORY=$BACKEND_GITHUB_REPOSITORY

# tzdata so TZ works; tini for proper signal handling as PID 1.
RUN apk add --no-cache tzdata tini

COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN mkdir -p /app/uploads/users /app/widgets /app/data \
    && chown -R node:node /app

USER node

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/api/test" > /dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
