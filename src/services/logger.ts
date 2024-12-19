import pino from 'pino';

// Configuración de transporte para los logs (utiliza pino-pretty para una salida más legible)
const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,  // Colores en los mensajes de log
    levelFirst: true, // Muestra el nivel del log primero
    translateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'", // Formato de fecha en UTC
    ignore: 'pid,hostname', // Ignorar PID y hostname en los logs
  },
});

// Inicialización del logger con el nivel adecuado según el entorno
const logger = pino(
  {
    name: 'websocket-presence',  // Nombre del servicio o aplicación
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',  // Nivel de log según el entorno
    serializers: {
      err: pino.stdSerializers.err, // Serializador para errores
      error: pino.stdSerializers.err, // Alias para serializar errores
    },
  },
  transport
);

// Interfaz personalizada para el logger
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error | unknown, ...args: any[]): void;
  success(message: string, ...args: any[]): void;
}

// Logger personalizado que adapta los métodos de pino
const customLogger: Logger = {
  // Método para loguear mensajes de depuración
  debug: (message: string, ...args: any[]) => 
    logger.debug(args.length ? args[0] : undefined, message),
  
  // Método para loguear mensajes informativos
  info: (message: string, ...args: any[]) => 
    logger.info(args.length ? args[0] : undefined, message),
  
  // Método para loguear mensajes de advertencia
  warn: (message: string, ...args: any[]) => 
    logger.warn(args.length ? args[0] : undefined, message),
  
  // Método para loguear errores, con manejo de tipo de error
  error: (message: string, error?: Error | unknown, ...args: any[]) => {
    // Si el error es una instancia de Error, lo logueamos con detalles adicionales
    if (error instanceof Error) {
      logger.error({ err: error, ...args.length ? args[0] : {} }, message);
    } else if (error) {
      // Si no es una instancia de Error, lo convertimos a un error estándar
      logger.error({ err: new Error(String(error)), ...args.length ? args[0] : {} }, message);
    } else {
      // Si no hay error, solo registramos el mensaje
      logger.error(args.length ? args[0] : undefined, message);
    }
  },
  
  // Método para loguear mensajes de éxito (con un ícono especial)
  success: (message: string, ...args: any[]) => 
    logger.info(args.length ? args[0] : undefined, `✨ ${message}`),
};

export default customLogger;
