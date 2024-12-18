import WebSocket from 'ws';
import { WebSocketClient, PresenceData, UserPresenceStatus, WebSocketMessageType } from '../../types/websocket';
import { firebaseService } from '../../services/firebase-service';
import logger from '../../services/logger';

export class PresenceService {
  private presenceMap: Map<string, PresenceData>;
  private connections: Map<string, Set<WebSocketClient>>;
  private unsubscribeFirebase?: () => void;

  constructor() {
    this.presenceMap = new Map();
    this.connections = new Map();
    this.initializeFirebaseListener();
  }

  private async initializeFirebaseListener(): Promise<void> {
    try {
      // Limpiar estados online antiguos al iniciar
      await firebaseService.cleanupOfflinePresence();

      // Escuchar cambios de presencia
      this.unsubscribeFirebase = await firebaseService.watchPresenceChanges(
        (presenceData) => {
          this.handlePresenceUpdate(presenceData);
        }
      );
      
      logger.info('Firebase presence listener initialized');
    } catch (error) {
      logger.error('Error initializing Firebase listener', error as Error);
    }
  }

  private handlePresenceUpdate(presenceData: PresenceData): void {
    this.presenceMap.set(presenceData.userId, presenceData);
    this.broadcastPresenceUpdate(presenceData.userId);
  }

  public async addConnection(userId: string, client: WebSocketClient): Promise<void> {
    try {
      // Inicializar conjunto de conexiones
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      
      this.connections.get(userId)?.add(client);
      
      // Crear datos de presencia
      const presenceData: PresenceData = {
        userId,
        status: UserPresenceStatus.ONLINE,
        lastSeen: new Date().toISOString()
      };
      
      // Actualizar localmente y en Firebase
      this.presenceMap.set(userId, presenceData);
      client.presenceData = presenceData;
      await firebaseService.updatePresence(presenceData);
      
      logger.info(`User ${userId} connected. Active connections: ${this.connections.get(userId)?.size}`);
    } catch (error) {
      logger.error(`Error adding connection for user ${userId}`, error as Error);
      throw error;
    }
  }

  public async removeConnection(userId: string, client: WebSocketClient): Promise<void> {
    try {
      const userConnections = this.connections.get(userId);
      if (userConnections) {
        userConnections.delete(client);
        
        // Si no quedan conexiones activas, actualizar estado a offline
        if (userConnections.size === 0) {
          const presenceData: PresenceData = {
            userId,
            status: UserPresenceStatus.OFFLINE,
            lastSeen: new Date().toISOString()
          };
          
          this.presenceMap.set(userId, presenceData);
          this.connections.delete(userId);
          await firebaseService.updatePresence(presenceData);
          
          // Notificar a otros sobre la desconexión
          this.broadcastPresenceUpdate(userId);
        }
        
        logger.info(`User ${userId} disconnected. Remaining connections: ${userConnections.size}`);
      }
    } catch (error) {
      logger.error(`Error removing connection for user ${userId}`, error as Error);
      throw error;
    }
  }

  public async updatePresence(userId: string, status: UserPresenceStatus, metadata?: Record<string, any>): Promise<void> {
    try {
        const presenceData = this.presenceMap.get(userId) || {
            userId,
            status: UserPresenceStatus.ONLINE,
            lastSeen: new Date().toISOString()
        };
  
        presenceData.status = status;
        presenceData.lastSeen = new Date().toISOString();
        if (metadata) {
            presenceData.metadata = { ...presenceData.metadata, ...metadata };
        }
  
        // Actualizar el mapa local
        this.presenceMap.set(userId, presenceData);
        
        // Actualizar en Firebase
        await firebaseService.updatePresence(presenceData);
        
        // Broadcast el cambio
        this.broadcastPresenceUpdate(userId);
        
        logger.debug(`Updated presence for ${userId} to ${status}`);
    } catch (error) {
        logger.error(`Error updating presence for ${userId}:`, error);
        throw error;
    }
  }

  private broadcastPresenceUpdate(userId: string): void {
    const presenceData = this.presenceMap.get(userId);
    if (presenceData) {
        const updateMessage = {
            type: WebSocketMessageType.PRESENCE_UPDATE,
            payload: presenceData,
            timestamp: new Date().toISOString()
        };
  
        // Enviar a todos los clientes conectados, incluyendo al usuario que cambió su estado
        this.connections.forEach((clients) => {
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(updateMessage));
                }
            });
        });
    }
  }

  public getPresence(userId: string): PresenceData | undefined {
    return this.presenceMap.get(userId);
  }

  public getAllPresence(): PresenceData[] {
    return Array.from(this.presenceMap.values());
  }
}