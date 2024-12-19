import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/environment';
import logger from './services/logger';
import { PresenceService } from './core/presence/presence-service';
import { WebSocketServer } from './core/websocket/websocket-service';
import { metricsService } from './services/metrics-service';

async function bootstrap() {
  try {
    const app = express();
    
    // Middleware para CORS
    app.use(cors());
    app.use(express.static('src/public')); // Sirve archivos estáticos
    
    // Endpoint para métricas
    app.get('/metrics', async (req, res) => {
      try {
        const metrics = await metricsService.getMetrics();
        res.set('Content-Type', metricsService.contentType);
        res.send(metrics);
        logger.debug('Metrics endpoint called');
      } catch (error) {
        logger.error('Error serving metrics:', error);
        res.status(500).send('Error collecting metrics');
      }
    });

    // Health check para verificar estado del servidor
    app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Crear servidor HTTP
    const server = http.createServer(app);

    // Inicializar servicios
    logger.info('Initializing services...');
    const presenceService = new PresenceService();
    const wsServer = new WebSocketServer(server, presenceService);

    // Iniciar servidor
    server.listen(config.server.port, config.server.host, () => {
      logger.success(`Server running at http://${config.server.host}:${config.server.port}`);
      logger.info('Available endpoints:');
      logger.info('- Health check: /health');
      logger.info('- Metrics: /metrics');
    });

    // Manejo de cierre del servidor de manera controlada
    process.on('SIGINT', () => {
      logger.info('Gracefully shutting down...');
      server.close(() => {
        logger.info('Server shut down successfully');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down...');
      server.close(() => {
        logger.info('Server shut down successfully');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    metricsService.incrementErrors('server', 'high', 'system');
    process.exit(1);
  }
}

// Arrancar el servidor
bootstrap();
