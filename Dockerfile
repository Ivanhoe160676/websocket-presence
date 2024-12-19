# Etapa base
FROM node:18-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache curl

# Etapa de desarrollo (opcional, si usas el contenedor solo para testing o desarrollo)
FROM base AS development
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

# Etapa de construcción (para compilar y optimizar el código antes de llevarlo a producción)
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
COPY firebase-service-account.json ./

# Healthcheck para asegurarnos de que el contenedor está funcionando correctamente
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
