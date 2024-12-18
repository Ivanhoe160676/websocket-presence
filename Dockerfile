# Etapa base
FROM node:18-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache curl

# Etapa de desarrollo
FROM base AS development
# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./
# Instalar dependencias
RUN npm install
# Copiar código fuente
COPY . .
# Comando para desarrollo
CMD ["npm", "run", "dev"]

# Etapa de construcción
FROM base AS builder
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa de producción
FROM base AS production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /usr/src/app/dist ./dist
# Copiar archivo de servicio de Firebase
COPY firebase-service-account.json ./
# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
# Comando para producción
CMD ["node", "dist/index.js"]