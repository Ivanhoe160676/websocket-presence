import WebSocket from 'ws';

// Enum de tipos de mensajes para WebSocket
export enum WebSocketMessageType {
  CONNECT = 'connect',           // Conexión
  DISCONNECT = 'disconnect',     // Desconexión
  HEARTBEAT = 'heartbeat',       // Latido de conexión
  HEARTBEAT_ACK = 'heartbeat_ack', // Confirmación de latido
  PRESENCE_UPDATE = 'presence_update', // Actualización de presencia
  ERROR = 'error'               // Error en la comunicación
}

// Enum de estados de presencia de usuario
export enum UserPresenceStatus {
  ONLINE = 'online',  // Usuario en línea
  OFFLINE = 'offline',  // Usuario desconectado
  AWAY = 'away',  // Usuario ausente
  BUSY = 'busy'   // Usuario ocupado
}

// Enum de tipos de cliente (plataformas de conexión)
export enum ClientType {
  FLUTTER = 'flutter',  // Cliente Flutter
  WEB = 'web',  // Cliente web
  MOBILE = 'mobile',  // Cliente móvil
  UNKNOWN = 'unknown'  // Cliente desconocido
}

// Interfaz para mensajes WebSocket
export interface WebSocketMessage {
  type: WebSocketMessageType;  // Tipo de mensaje
  userId?: string;  // ID del usuario, si aplica
  timestamp: string;  // Marca de tiempo del mensaje
  payload?: any;  // Cualquier carga útil adicional
  serverTime?: number;  // Tiempo del servidor cuando se envió el mensaje
}

// Interfaz para datos de presencia de un usuario
export interface PresenceData {
  userId: string;  // ID del usuario
  status: UserPresenceStatus;  // Estado de presencia del usuario
  lastSeen: string;  // Última vez que el usuario estuvo activo
  metadata?: Record<string, any>;  // Información adicional opcional
}

// Extensión de WebSocket para agregar datos adicionales
export interface WebSocketClient extends WebSocket {
  userId?: string;  // ID del usuario asociado al WebSocket
  clientType?: ClientType;  // Tipo de cliente (Flutter, Web, etc.)
  isAlive: boolean;  // Estado de conexión activa
  connectionTime: Date;  // Hora de la conexión
  messageCount: number;  // Número de mensajes enviados por el cliente
  lastMessageTime: number;  // Marca de tiempo del último mensaje recibido
  presenceData?: PresenceData;  // Datos de presencia del usuario
}

// Nueva interfaz para estadísticas del servidor WebSocket
export interface ServerStats {
  totalConnections: number;  // Número total de conexiones activas
  uniqueUsers: number;  // Número de usuarios únicos conectados
  uptime: number;  // Tiempo de actividad del servidor en milisegundos
  memory: {
    heapUsed: number;  // Memoria utilizada por el servidor
    heapTotal: number;  // Memoria total asignada al servidor
    rss: number;  // Memoria residente (RSS)
  };
  presenceStats: {
    online: number;  // Número de usuarios en línea
    offline: number;  // Número de usuarios fuera de línea
    away: number;  // Número de usuarios ausentes
    busy: number;  // Número de usuarios ocupados
  };
}

// Nueva interfaz para opciones del servidor WebSocket
export interface WebSocketServerOptions {
  heartbeatInterval: number;  // Intervalo en milisegundos para enviar latidos
  maxConnectionsPerUser: number;  // Número máximo de conexiones permitidas por usuario
  messageRateLimit: number;  // Límite de mensajes por segundo
  maxMessageSize: number;  // Tamaño máximo de mensaje permitido
  logLevel?: 'debug' | 'info' | 'warn' | 'error';  // Nivel de logueo
}

// Nueva interfaz para representar los errores de WebSocket
export interface WebSocketError {
  code: string;  // Código del error
  message: string;  // Descripción del error
  timestamp: Date;  // Fecha y hora del error
  userId?: string;  // ID del usuario asociado, si aplica
  clientType?: ClientType;  // Tipo de cliente relacionado, si aplica
  details?: any;  // Detalles adicionales sobre el error
}
