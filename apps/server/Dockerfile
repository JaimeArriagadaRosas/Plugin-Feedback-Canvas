# Etapa de construcción
FROM node:24-alpine AS builder

WORKDIR /app

# Instalar dependencias requeridas para construir módulos nativos (ej. bcrypt) si las hay
RUN apk add --no-cache python3 make g++ 

# Copiar configuración de workspaces si existe (asumiendo monorepo)
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/logger/package.json ./packages/logger/

# Instalar todas las dependencias (incluyendo devDependencies para compilar)
RUN npm install

# Copiar el resto del código
COPY . .

# Si el servidor necesita transpilación, ejecutar build aquí
# RUN npm run build --workspace=apps/server

# Limpiar dev dependencies para producción
RUN npm prune --production

# Etapa de producción
FROM node:24-alpine AS production

WORKDIR /app

# Instalar dependencias de sistema mínimas necesarias en producción
RUN apk add --no-cache curl tzdata

# Copiar node_modules y código construido desde el builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/server ./apps/server
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/logger ./packages/logger

# Cambiar a un usuario sin privilegios por seguridad
USER node

WORKDIR /app/apps/server

EXPOSE 3000

CMD ["npm", "start"]
