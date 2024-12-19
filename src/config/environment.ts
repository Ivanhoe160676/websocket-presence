import dotenv from 'dotenv'; // Cargar variables de entorno desde el archivo .env
import { cleanEnv, str, port } from 'envalid'; // Validación y limpieza de variables de entorno

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

/**
 * Validar y tipar las variables de entorno.
 * cleanEnv garantiza que las variables sean válidas y establece valores predeterminados si no están presentes.
 */
export const env = cleanEnv(process.env, {
  // Entorno de ejecución (development, test, production)
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),

  // Configuración del servidor
  PORT: port({ default: 3000 }), // Puerto en el que se ejecutará el servidor
  HOST: str({ default: '127.0.0.1' }), // Host para escuchar conexiones
  
  // Configuración de WebSocket
  WS_HEARTBEAT_INTERVAL: str({ default: '30000' }), // Intervalo para enviar "pings" a los clientes WebSocket
  CORS_ORIGIN: str({ default: '*' }), // Orígenes permitidos para CORS (Cross-Origin Resource Sharing)

  // Configuración de logs
  LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info' }), // Nivel de logs
  LOG_TO_FILE: str({ choices: ['true', 'false'], default: 'false' }), // Indica si los logs se deben guardar en archivo
  LOG_FILE_PATH: str({ default: './logs/websocket-service.log' }), // Ruta del archivo de logs
});

/**
 * Configuración general de la aplicación basada en las variables de entorno validadas.
 * Se utiliza como un objeto constante para facilitar el acceso a la configuración desde cualquier parte del código.
 */
export const config = {
  // Flags para determinar el entorno actual
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',

  // Configuración del servidor
  server: {
    port: env.PORT, // Puerto del servidor
    host: env.HOST, // Host del servidor
  },

  // Configuración de WebSocket
  websocket: {
    heartbeatInterval: parseInt(env.WS_HEARTBEAT_INTERVAL, 10), // Intervalo en milisegundos para los "pings"
    allowedOrigins: env.CORS_ORIGIN.split(','), // Orígenes permitidos, separados por comas
  },

  // Configuración de logs
  logging: {
    level: env.LOG_LEVEL, // Nivel de logs (debug, info, warn, error)
    toFile: env.LOG_TO_FILE === 'true', // Indica si se deben guardar logs en un archivo
    filePath: env.LOG_FILE_PATH, // Ruta del archivo de logs
  },
} as const;
