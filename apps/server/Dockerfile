# Dependencias de build del monorepo
FROM node:22-alpine AS dependencies

WORKDIR /app

RUN apk add --no-cache python3 make g++

# Copiar manifests de todos los workspaces para npm ci
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY apps/installer/package.json ./apps/installer/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/canvas-api/package.json ./packages/canvas-api/
COPY packages/plugin-database/package.json ./packages/plugin-database/

RUN npm ci

# Construcción del frontend y preparación de dependencias productivas
FROM dependencies AS builder

COPY . .
RUN npm run build
RUN npm prune --omit=dev

# Runtime inmutable
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl tzdata
RUN mkdir -p /app/logs /app/apps/server/certs && chown -R node:node /app

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=builder /app/apps/server ./apps/server
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/dist ./dist

USER node

ENV NODE_ENV=production \
    LOG_TO_FILE=false \
    FRONTEND_DIST=/app/dist

EXPOSE 3000

CMD ["node", "apps/server/src/server.js"]
