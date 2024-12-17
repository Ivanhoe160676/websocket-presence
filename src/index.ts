// src/index.ts
import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import { config } from './config/environment';
import logger from './services/logger';

async function bootstrap() {
  try {
    // Inicializar Express
    const app = express();
    app.use(cors());
    app.use(express.static('src/public'));
    
    // Crear servidor HTTP
    const server = http.createServer(app);
    
    // Configurar WebSocket Server
    const wss = new WebSocket.Server({ server });

    // Endpoint de salud
    app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        websocket: {
          clients: wss.clients.size
        }
      });
    });

    // WebSocket connection handler
    wss.on('connection', (ws) => {
      logger.info('New WebSocket connection established');

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to WebSocket Server',
        timestamp: new Date().toISOString()
      }));

      // Handle incoming messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.info('Received message:', data);

          // Echo the message back
          ws.send(JSON.stringify({
            type: 'echo',
            data,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          logger.error('Error processing message', error as Error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        logger.info('Client disconnected');
      });
    });

    // Start server
    server.listen(config.server.port, config.server.host, () => {
      logger.success(`Server started successfully on port ${config.server.port}`);
      logger.info(`Health check available at http://localhost:${config.server.port}/health`);
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Error handlers
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled Promise Rejection', error);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

// Start the application
bootstrap();