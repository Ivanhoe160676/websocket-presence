import WebSocket from 'ws';

export enum WebSocketMessageType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  HEARTBEAT = 'heartbeat',
  HEARTBEAT_ACK = 'heartbeat_ack',
  PRESENCE_UPDATE = 'presence_update',
  ERROR = 'error'
}

export enum UserPresenceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy'
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  userId?: string;
  timestamp: string;
  payload?: any;
}

export interface PresenceData {
  userId: string;
  status: UserPresenceStatus;
  lastSeen: string;
  metadata?: Record<string, any>;
}

// Extendemos de WebSocket para incluir todos sus métodos y propiedades
export interface WebSocketClient extends WebSocket {
  userId?: string;
  isAlive?: boolean;
  presenceData?: PresenceData;
}