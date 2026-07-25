# Etapa de construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependencias requeridas para construir módulos nativos (ej. bcrypt) si las hay
RUN apk add --no-cache python3 make g++ 

# Copiar configuración de workspaces si existe (asumiendo monorepo)
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/

# Instalar todas las dependencias (incluyendo devDependencies para compilar)
RUN npm ci

# Copiar el resto del código
COPY . .

# Si el servidor necesita transpilación, ejecutar build aquí
# RUN npm run build --workspace=packages/server

# Limpiar dev dependencies para producción
RUN npm prune --production

# Etapa de producción
FROM node:18-alpine AS production

WORKDIR /app

# Instalar dependencias de sistema mínimas necesarias en producción
RUN apk add --no-cache curl tzdata

# Copiar node_modules y código construido desde el builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/server ./packages/server

# Cambiar a un usuario sin privilegios por seguridad
USER node

WORKDIR /app/packages/server

EXPOSE 3000

CMD ["npm", "start"]
