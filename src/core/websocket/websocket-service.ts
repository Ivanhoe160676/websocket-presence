import WebSocket from 'ws';
import { Server } from 'http';
import { ClientType, WebSocketClient, WebSocketMessage, WebSocketMessageType } from '../../types/websocket';
import { PresenceService } from '../presence/presence-service';
import logger from '../../services/logger';
import { metricsService } from '../../services/metrics-service';

export class WebSocketServer {
  private wss: WebSocket.Server;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly clientMap: Map<string, Set<WebSocketClient>> = new Map();

  constructor(
    server: Server,
    private presenceService: PresenceService,
    private options = { 
      heartbeatInterval: 30000, // Intervalo de latido
      maxConnectionsPerUser: 5, // Máximo de conexiones por usuario
      messageRateLimit: 100, // Mensajes por segundo
      maxMessageSize: 1024 * 1024 // 1MB de tamaño máximo para un mensaje
    }
  ) {
    this.wss = new WebSocket.Server({ server });
    this.initialize();
  }

  // Inicializa el servidor WebSocket y sus configuraciones
  private initialize(): void {
    this.setupServerHandlers();
    this.startHeartbeat();
    this.setupServerMetrics();
    
    logger.info('WebSocket server initialized with options:', this.options);
  }

  // Configura las métricas del servidor
  private setupServerMetrics(): void {
    setInterval(() => {
      const totalClients = this.getConnectedClients();
      const uniqueUsers = this.clientMap.size;
      
      metricsService.updateClients('total', 'all', 'any', totalClients);
      metricsService.updateClients('unique', 'all', 'any', uniqueUsers);
      
      // Métricas de memoria
      const memUsage = process.memoryUsage();
      metricsService.observeSystemMetrics('memory_heap_used', memUsage.heapUsed);
      metricsService.observeSystemMetrics('memory_heap_total', memUsage.heapTotal);
    }, 5000); // Actualiza cada 5 segundos
  }

  // Configura los manejadores de eventos para el servidor WebSocket
  private setupServerHandlers(): void {
    this.wss.on('connection', async (ws: WebSocketClient, req) => {
      const connectionStart = Date.now();
      try {
        const userId = this.getUserIdFromRequest(req);
        const clientType = this.getClientType(req);
        
        if (!userId) {
          this.handleError(ws, 'AUTH_ERROR', 'userId is required');
          return;
        }

        if (!this.canUserConnect(userId)) {
          this.handleError(ws, 'LIMIT_ERROR', 'Maximum connections reached for user');
          return;
        }
        
        this.addClient(userId, ws);
        metricsService.incrementConnections('success', clientType, 'wss');
        metricsService.observeLatency('connection_setup', (Date.now() - connectionStart) / 1000);
        
        ws.userId = userId;
        ws.clientType = clientType as ClientType;
        ws.isAlive = true;
        ws.connectionTime = new Date();
        ws.messageCount = 0;
        ws.lastMessageTime = Date.now();

        this.setupClientHandlers(ws);        
      
        await this.presenceService.addConnection(userId, ws);

        // Enviar confirmación de conexión
        this.sendMessage(ws, {
          type: WebSocketMessageType.CONNECT,
          userId,
          timestamp: new Date().toISOString(),
          serverTime: Date.now()
        });

        logger.info('Client connected', {
          userId,
          clientType,
          timestamp: new Date().toISOString(),
          remoteAddress: req.socket.remoteAddress
        });

      } catch (error) {
        metricsService.incrementConnections('error', 'unknown', 'wss');
        metricsService.incrementErrors('connection_failed', 'high', 'server');
        logger.error('Connection error:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  // Registra una nueva conexión de un cliente
  private addClient(userId: string, ws: WebSocketClient): void {
    if (!this.clientMap.has(userId)) {
      this.clientMap.set(userId, new Set());
    }
    this.clientMap.get(userId)?.add(ws);
  }

  // Elimina una conexión de un cliente
  private removeClient(userId: string, ws: WebSocketClient): void {
    const userConnections = this.clientMap.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.clientMap.delete(userId);
      }
    }
  }

  // Verifica si el usuario puede conectarse (basado en el límite de conexiones)
  private canUserConnect(userId: string): boolean {
    const currentConnections = this.clientMap.get(userId)?.size || 0;
    return currentConnections < this.options.maxConnectionsPerUser;
  }

  // Extrae el ID de usuario de la solicitud HTTP
  private getUserIdFromRequest(req: any): string | null {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      return url.searchParams.get('userId');
    } catch {
      return null;
    }
  }

  // Determina el tipo de cliente basado en el user-agent
  private getClientType(req: any): string {
    return req.headers['user-agent']?.includes('Flutter') ? 'flutter' : 'unknown';
  }

  // Configura los manejadores de eventos para cada cliente WebSocket
  private setupClientHandlers(ws: WebSocketClient): void {
    ws.on('pong', () => {
      ws.isAlive = true;
      metricsService.observeLatency('heartbeat', 0.001); // 1ms de latencia nominal para pong
    });

    ws.on('message', this.createMessageHandler(ws));
    ws.on('close', this.createCloseHandler(ws));
    ws.on('error', this.createErrorHandler(ws));
  }

  // Crea un manejador para los mensajes entrantes
  private createMessageHandler(ws: WebSocketClient) {
    return async (data: WebSocket.RawData) => {
      const messageStart = Date.now();
      try {
        const messageSize = Buffer.from(data as Buffer).byteLength;
   
        if (messageSize > this.options.maxMessageSize) {
          this.handleError(ws, 'MESSAGE_TOO_LARGE', 'Message exceeds size limit');
          return;
        }

        if (!this.checkMessageRateLimit(ws)) {
          this.handleError(ws, 'RATE_LIMIT', 'Message rate limit exceeded');
          return;
        }

        const message = JSON.parse(data.toString()) as WebSocketMessage;
        const messageType = message.type || 'unknown';
        
        metricsService.incrementMessages(messageType, 'inbound', 'success');
        metricsService.observeMessageSize('message', 'inbound', messageSize);
        metricsService.observeLatency('message_processing', (Date.now() - messageStart) / 1000);
        
        await this.handleMessage(ws, message);

      } catch (error) {
        metricsService.incrementErrors('message_processing', 'medium', 'server');
        logger.error('Message processing error:', {
          error,
          userId: ws.userId,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  // Crea un manejador para el cierre de la conexión
  private createCloseHandler(ws: WebSocketClient) {
    return async () => {
      try {
        if (ws.userId) {
          this.removeClient(ws.userId, ws);
          metricsService.decrementConnections(ws.clientType || 'unknown');
          await this.presenceService.removeConnection(ws.userId, ws);
          
          const sessionDuration = (Date.now() - ws.connectionTime.getTime()) / 1000;
          metricsService.observeLatency('session_duration', sessionDuration);
          
          logger.info('Client disconnected', {
            userId: ws.userId,
            duration: sessionDuration,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('Error in close handler:', error);
        metricsService.incrementErrors('close_handler', 'low', 'server');
      }
    };
  }

  // Crea un manejador para los errores del WebSocket
  private createErrorHandler(ws: WebSocketClient) {
    return (error: Error) => {
      metricsService.incrementErrors('websocket_error', 'high', 'client');
      logger.error('WebSocket error:', {
        error,
        userId: ws.userId,
        timestamp: new Date().toISOString()
      });
    };
  }

  // Maneja los mensajes recibidos
  private async handleMessage(ws: WebSocketClient, message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case WebSocketMessageType.HEARTBEAT:
        this.handleHeartbeat(ws);
        break;
        
      case WebSocketMessageType.PRESENCE_UPDATE:
        await this.handlePresenceUpdate(ws, message);
        break;
        
      case WebSocketMessageType.DISCONNECT:
        this.handleDisconnect(ws);
        break;
        
      default:
        logger.debug('Unknown message type', {
          type: message.type,
          userId: ws.userId
        });
    }
  }

  // Verifica el límite de tasa de mensajes (mensajes por segundo)
  private checkMessageRateLimit(ws: WebSocketClient): boolean {
    const now = Date.now();
    ws.messageCount = (ws.messageCount || 0) + 1;
    
    if (now - (ws.lastMessageTime || 0) >= 1000) {
      ws.messageCount = 1;
      ws.lastMessageTime = now;
      return true;
    }
    
    return ws.messageCount <= this.options.messageRateLimit;
  }

  // Maneja los errores del WebSocket
  private handleError(ws: WebSocketClient, code: string, message: string): void {
    metricsService.incrementErrors(code.toLowerCase(), 'medium', 'server');
    logger.error(`WebSocket error: ${code}`, { message, userId: ws.userId });
    ws.close(1008, message);
  }

  // Maneja el latido del WebSocket (ping/pong)
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((client: WebSocket) => {
        const ws = client as WebSocketClient;
        if (ws.isAlive === false) {
          // Si el cliente no respondió al ping, se termina la conexión
          metricsService.incrementErrors('heartbeat_timeout', 'medium', 'client');
          return ws.terminate();
        }
  
        // Se envía un ping para mantener la conexión activa
        ws.isAlive = false;
        ws.ping();
      });
    }, this.options.heartbeatInterval); // Intervalo de latidos configurado
  }
  
  // Envía un mensaje a un cliente WebSocket
  private sendMessage(ws: WebSocketClient, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const data = JSON.stringify(message);
        ws.send(data); // Enviar el mensaje al cliente
        metricsService.incrementMessages(message.type, 'outbound', 'success');
        metricsService.observeMessageSize('message', 'outbound', data.length);
      } catch (error) {
        // Manejo de errores al enviar el mensaje
        metricsService.incrementErrors('send_message', 'medium', 'server');
        logger.error('Send message error:', error);
      }
    }
  }

  // Realiza una transmisión de un mensaje a todos los clientes conectados
  public broadcast(message: WebSocketMessage, exclude?: string): void {
    const data = JSON.stringify(message);
    let sentCount = 0;
    
    // Itera sobre todos los clientes conectados
    this.wss.clients.forEach((rawClient: WebSocket) => {
      const client = rawClient as WebSocketClient;
      if (client.readyState === WebSocket.OPEN && client.userId !== exclude) {
        client.send(data); // Enviar el mensaje al cliente
        sentCount++;
      }
    });
    
    // Registra el conteo de mensajes transmitidos
    metricsService.incrementMessages('broadcast', 'outbound', 'success');
    logger.debug(`Broadcast message sent to ${sentCount} clients`);
  }

  // Obtiene la cantidad de clientes conectados
  public getConnectedClients(): number {
    return this.wss.clients.size;
  }

  // Obtiene estadísticas del WebSocket server
  public getStats(): any {
    return {
      totalConnections: this.wss.clients.size,
      uniqueUsers: this.clientMap.size,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  // Maneja el latido del WebSocket (ping/pong)
private handleHeartbeat(ws: WebSocketClient): void {
  ws.isAlive = true; // Marca al cliente como "vivo"
  this.sendMessage(ws, {
    type: WebSocketMessageType.HEARTBEAT_ACK, // Acknowledge del latido
    timestamp: new Date().toISOString(),
    serverTime: Date.now()
  });
}

// Maneja la actualización de la presencia de un usuario
private async handlePresenceUpdate(ws: WebSocketClient, message: WebSocketMessage): Promise<void> {
  if (ws.userId && message.payload?.status) {
    // Actualiza el estado de presencia del usuario
    await this.presenceService.updatePresence(
      ws.userId,
      message.payload.status,
      message.payload.metadata
    );
    // Registra la actualización de presencia
    metricsService.incrementPresenceUpdates(message.payload.status, 'success');
  }
}

// Maneja la desconexión de un cliente
private handleDisconnect(ws: WebSocketClient): void {
  // Cierra la conexión del cliente de manera controlada
  ws.close(1000, 'Client requested disconnect');
}

}
