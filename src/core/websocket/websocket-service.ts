import WebSocket from 'ws';
import { Server } from 'http';
import { WebSocketClient, WebSocketMessage, WebSocketMessageType } from '../../types/websocket';
import { PresenceService } from '../presence/presence-service';
import logger from '../../services/logger';
import { metricsService } from '../../services/metrics-service';

export class WebSocketServer {
  private wss: WebSocket.Server;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    server: Server,
    private presenceService: PresenceService,
    private options = { 
      heartbeatInterval: 30000 
    }
  ) {
    this.wss = new WebSocket.Server({ server });
    this.initialize();
  }

  private initialize(): void {
    this.setupServerHandlers();
    this.startHeartbeat();
  }

  private setupServerHandlers(): void {
    this.wss.on('connection', async (ws: WebSocketClient, req) => {
      try {
        const userId = this.getUserIdFromRequest(req);
        
        if (!userId) {
          ws.close(1002, 'userId is required');
          return;
        }
        
        // Registrar métrica de conexión
        metricsService.incrementConnections('success');
        logger.info(`New connection metrics registered for user ${userId}`);
  
        ws.userId = userId;
        ws.isAlive = true;

        // Configurar handlers del cliente
        this.setupClientHandlers(ws);        
      
        // Registrar presencia
        await this.presenceService.addConnection(userId, ws);

        // Enviar mensaje de conexión exitosa
        this.sendMessage(ws, {
          type: WebSocketMessageType.CONNECT,
          userId,
          timestamp: new Date().toISOString()
        });

        logger.info(`Client connected - userId: ${userId}`);
      } catch (error) {
        metricsService.incrementConnections('error');
        logger.error('Error handling connection:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  private getUserIdFromRequest(req: any): string | null {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      return url.searchParams.get('userId');
    } catch {
      return null;
    }
  }

  private setupClientHandlers(ws: WebSocketClient): void {
    // Ping/Pong handlers
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Message handler
    ws.on('message', async (data: WebSocket.RawData) => {
      try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      const messageType = message.type || 'unknown';
      
    // Registrar métricas primero
    metricsService.incrementMessages(messageType);
    metricsService.observeMessageSize(data.toString().length);
    logger.debug(`Message metrics registered - type: ${messageType}, size: ${data.toString().length}`);
        
    switch (message.type) {
      case WebSocketMessageType.HEARTBEAT:
        this.handleHeartbeat(ws);
        break;
        
      case WebSocketMessageType.PRESENCE_UPDATE:
        if (ws.userId && message.payload?.status) {
          await this.presenceService.updatePresence(
            ws.userId, 
            message.payload.status,
            message.payload.metadata
          );
          logger.debug(`Updated presence for ${ws.userId} to ${message.payload.status}`);
        }
        break;
        
      case WebSocketMessageType.DISCONNECT:
        ws.close(1000, 'Client requested disconnect');
        break;
        
      default:
        logger.debug(`Received message of type ${message.type} from ${ws.userId}`);
    }
      } catch (error) {
        metricsService.incrementErrors('message_processing');
        logger.error('Error processing message:', error);
     }
    });

    // Close handler
    ws.on('close', async () => {
      if (ws.userId) {
        metricsService.decrementConnections(); // Decrementar el gauge cuando se cierra la conexión
        await this.presenceService.removeConnection(ws.userId, ws);
        logger.info(`Client disconnected - userId: ${ws.userId}`);
      }
    });

    // Error handler
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocketClient) => {
        if (ws.isAlive === false) {
          logger.warn(`Terminating inactive connection for user ${ws.userId}`);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, this.options.heartbeatInterval);

    // Cleanup on server close
    this.wss.on('close', () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
    });
  }

  private handleHeartbeat(ws: WebSocketClient): void {
    ws.isAlive = true;
    this.sendMessage(ws, {
      type: WebSocketMessageType.HEARTBEAT_ACK,
      timestamp: new Date().toISOString()
    });
  }

  private sendMessage(ws: WebSocketClient, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending message:', error);
      }
    }
  }

  public broadcast(message: WebSocketMessage, exclude?: string): void {
    this.wss.clients.forEach((client: WebSocketClient) => {
      if (client.readyState === WebSocket.OPEN && client.userId !== exclude) {
        this.sendMessage(client, message);
      }
    });
  }

  public getConnectedClients(): number {
    return this.wss.clients.size;
  }
}