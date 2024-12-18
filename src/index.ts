// src/index.ts
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
    app.use(cors());
    app.use(express.static('src/public'));

    // Endpoint de métricas
    app.get('/metrics', async (req, res) => {
      try {
        const metrics = await metricsService.getMetrics();
        res.set('Content-Type', metricsService.contentType);
        res.send(metrics);
        
        // Log para debug
        logger.debug('Metrics endpoint called');
      } catch (error) {
        logger.error('Error serving metrics:', error);
        res.status(500).send('Error collecting metrics');
      }
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    const server = http.createServer(app);
    const presenceService = new PresenceService();
    const wsServer = new WebSocketServer(server, presenceService);

    server.listen(config.server.port, config.server.host, () => {
      logger.success(`Server running at http://${config.server.host}:${config.server.port}`);
      logger.info('Available endpoints:');
      logger.info('- Health check: /health');
      logger.info('- Metrics: /metrics');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();