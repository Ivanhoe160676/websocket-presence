# Guía de Instalación

## Requisitos Previos

- Node.js (v18 o superior)
- npm o yarn
- Docker (opcional, para contenedores)

## Instalación Local

1. **Clonar el Repositorio**
```bash
git clone https://github.com/Ivanhoe160676/websocket-presence.git
cd websocket-presence
```

2. **Instalar Dependencias**
```bash
npm install
```

3. **Configurar Variables de Entorno**
```bash
cp .env.example .env
```
Editar `.env` con tus configuraciones:
```env
NODE_ENV=development
HOST=localhost
PORT=3000
LOG_LEVEL=debug
```

4. **Iniciar en Modo Desarrollo**
```bash
npm run dev
```

## Instalación en Hostinger

1. **Preparar el Proyecto**
```bash
npm run build
```

2. **Configurar en Hostinger**
- Acceder al Panel de Control de Hostinger
- Ir a la sección "Websites" > Tu dominio > "Manage"
- Seleccionar "Node.js" como tecnología
- Configurar las variables de entorno:
  - `NODE_ENV=production`
  - `PORT=3000`
  - `HOST=0.0.0.0`

3. **Desplegar**
- Subir los archivos vía SSH o FTP
- Instalar dependencias: `npm install --production`
- Iniciar el servicio: `npm start`

## Instalación con Docker

1. **Construir la Imagen**
```bash
docker build -t websocket-presence .
```

2. **Ejecutar el Contenedor**
```bash
docker run -d \
  -p 3000:3000 \
  --name websocket-presence \
  -e NODE_ENV=production \
  websocket-presence
```

## Verificación de la Instalación

1. **Comprobar el Servidor**
```bash
curl http://localhost:3000/health
```

2. **Verificar Métricas**
```bash
curl http://localhost:3000/metrics
```

3. **Probar WebSocket**
Abrir `src/public/test.html` en el navegador

## Solución de Problemas

### Errores Comunes

1. **Error: EADDRINUSE**
   - Puerto 3000 en uso
   - Solución: Cambiar puerto en `.env`

2. **Error: Cannot find module**
   - Dependencias no instaladas
   - Solución: `npm install`

3. **Error de conexión WebSocket**
   - Verificar firewall
   - Comprobar configuración de proxy

### Logs

- Desarrollo: `npm run dev`
- Producción: `pm2 logs`