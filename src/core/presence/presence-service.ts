import WebSocket from 'ws';
import { WebSocketClient, PresenceData, UserPresenceStatus } from '../../types/websocket';
import { firebaseService } from '../../services/firebase-service';
import logger from '../../services/logger';
import { metricsService } from '../../services/metrics-service';

/**
 * Servicio para manejar la presencia de usuarios en tiempo real.
 * - Gestiona el estado de conexión de usuarios (`online`/`offline`).
 * - Sincroniza cambios con Firebase y notifica actualizaciones a través de WebSocket.
 */
export class PresenceService {
  private presenceMap: Map<string, PresenceData>; // Almacena el estado de presencia de los usuarios
  private connections: Map<string, Set<WebSocketClient>>; // Almacena conexiones activas de WebSocket por usuario
  private unsubscribeFirebase?: () => void; // Función para detener la escucha de Firebase

  constructor() {
    this.presenceMap = new Map(); // Inicializa el mapa de presencias
    this.connections = new Map(); // Inicializa el mapa de conexiones activas
    this.initializeFirebaseListener(); // Inicia la escucha de cambios de presencia en Firebase
  }

  /**
   * Inicializa el listener de Firebase para cambios de presencia.
   * - Limpia estados offline antiguos.
   * - Escucha actualizaciones de presencia en tiempo real.
   */
  private async initializeFirebaseListener(): Promise<void> {
    try {
      await firebaseService.cleanupOfflinePresence(); // Limpieza inicial de estados offline en Firebase
      this.unsubscribeFirebase = await firebaseService.watchPresenceChanges(
        (presenceData) => this.handlePresenceUpdate(presenceData)
      );
      logger.info('Firebase presence listener initialized');
    } catch (error) {
      logger.error('Error initializing Firebase listener:', error);
      metricsService.incrementErrors('firebase_init', 'high', 'server');
    }
  }

  /**
   * Maneja las actualizaciones de presencia provenientes de Firebase.
   * - Actualiza el mapa local de presencias.
   * - Difunde el cambio a través de WebSocket.
   */
  private handlePresenceUpdate(presenceData: PresenceData): void {
    try {
      this.presenceMap.set(presenceData.userId, presenceData);
      this.broadcastPresenceUpdate(presenceData.userId);
      metricsService.incrementMessages('presence_update', 'inbound', 'success');
    } catch (error) {
      logger.error('Error handling presence update:', error);
      metricsService.incrementErrors('presence_update', 'medium', 'server');
    }
  }

  /**
   * Agrega una conexión WebSocket para un usuario.
   * - Actualiza el estado de presencia del usuario a `online`.
   * - Notifica a Firebase y registra métricas.
   */
  public async addConnection(userId: string, client: WebSocketClient): Promise<void> {
    try {
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId)?.add(client);

      const presenceData: PresenceData = {
        userId,
        status: UserPresenceStatus.ONLINE,
        lastSeen: new Date().toISOString(),
      };

      this.presenceMap.set(userId, presenceData);
      await firebaseService.updatePresence(presenceData);
      metricsService.incrementConnections('success', 'presence', 'websocket');
      logger.info(`User ${userId} connected. Active connections: ${this.connections.get(userId)?.size}`);
    } catch (error) {
      logger.error(`Error adding connection for user ${userId}:`, error);
      metricsService.incrementErrors('connection_add', 'high', 'server');
      throw error;
    }
  }

  /**
   * Remueve una conexión WebSocket para un usuario.
   * - Si no quedan conexiones activas, actualiza el estado de presencia a `offline`.
   * - Notifica a Firebase y difunde el cambio.
   */
  public async removeConnection(userId: string, client: WebSocketClient): Promise<void> {
    try {
      const userConnections = this.connections.get(userId);
      if (userConnections) {
        userConnections.delete(client);

        if (userConnections.size === 0) {
          const presenceData: PresenceData = {
            userId,
            status: UserPresenceStatus.OFFLINE,
            lastSeen: new Date().toISOString(),
          };

          this.presenceMap.set(userId, presenceData);
          this.connections.delete(userId);
          await firebaseService.updatePresence(presenceData);
          this.broadcastPresenceUpdate(userId);
          metricsService.incrementMessages('presence_offline', 'outbound', 'success');
        }

        logger.info(`User ${userId} disconnected. Remaining connections: ${userConnections.size}`);
      }
    } catch (error) {
      logger.error(`Error removing connection for user ${userId}:`, error);
      metricsService.incrementErrors('connection_remove', 'medium', 'server');
      throw error;
    }
  }

  /**
   * Actualiza el estado de presencia de un usuario.
   * - Permite añadir metadatos personalizados.
   * - Difunde el cambio y registra métricas.
   */
  public async updatePresence(userId: string, status: UserPresenceStatus, metadata?: Record<string, any>): Promise<void> {
    try {
      const presenceData = this.presenceMap.get(userId) || {
        userId,
        status: UserPresenceStatus.ONLINE,
        lastSeen: new Date().toISOString(),
      };

      presenceData.status = status;
      presenceData.lastSeen = new Date().toISOString();
      if (metadata) {
        presenceData.metadata = { ...presenceData.metadata, ...metadata };
      }

      this.presenceMap.set(userId, presenceData);
      await firebaseService.updatePresence(presenceData);
      this.broadcastPresenceUpdate(userId);
      metricsService.incrementMessages('presence_update', 'outbound', 'success');
      logger.debug(`Updated presence for ${userId} to ${status}`);
    } catch (error) {
      logger.error(`Error updating presence for ${userId}:`, error);
      metricsService.incrementErrors('presence_update', 'medium', 'server');
      throw error;
    }
  }

  /**
   * Difunde actualizaciones de presencia a todos los clientes conectados.
   */
  private broadcastPresenceUpdate(userId: string): void {
    try {
      const presenceData = this.presenceMap.get(userId);
      if (presenceData) {
        const message = {
          type: 'presence_update',
          payload: presenceData,
          timestamp: new Date().toISOString(),
        };

        this.connections.forEach((clients) => {
          clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(message));
            }
          });
        });
      }
    } catch (error) {
      logger.error('Error broadcasting presence update:', error);
      metricsService.incrementErrors('broadcast_presence', 'low', 'server');
    }
  }

  /**
   * Obtiene el estado de presencia de un usuario.
   */
  public getPresence(userId: string): PresenceData | undefined {
    return this.presenceMap.get(userId);
  }

  /**
   * Obtiene el estado de presencia de todos los usuarios.
   */
  public getAllPresence(): PresenceData[] {
    return Array.from(this.presenceMap.values());
  }

  /**
   * Limpia recursos al cerrar el servicio.
   * - Detiene la escucha de Firebase.
   * - Limpia mapas locales de presencia y conexiones.
   */
  public cleanup(): void {
    if (this.unsubscribeFirebase) {
      this.unsubscribeFirebase();
    }
    this.presenceMap.clear();
    this.connections.clear();
  }
}
