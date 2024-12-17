// src/config/environment.ts
import dotenv from 'dotenv';
import { cleanEnv, str, port, url } from 'envalid';

// Cargar variables de entorno desde .env
dotenv.config();

export const env = cleanEnv(process.env, {
  // Server
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 3000 }),
  HOST: str({ default: '0.0.0.0' }),

  // Firebase
  FIREBASE_PROJECT_ID: str(),
  FIREBASE_PRIVATE_KEY: str(),
  FIREBASE_CLIENT_EMAIL: str(),

  // WebSocket
  WS_HEARTBEAT_INTERVAL: str({ default: '30000' }),
  ALLOWED_ORIGINS: str({ default: '*' }),
});

// Configuraciones derivadas
export const config = {
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  
  server: {
    port: env.PORT,
    host: env.HOST,
  },
  
  websocket: {
    heartbeatInterval: parseInt(env.WS_HEARTBEAT_INTERVAL, 10),
    allowedOrigins: env.ALLOWED_ORIGINS.split(','),
  },
  
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
  },
} as const;