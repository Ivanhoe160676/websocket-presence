import pino from 'pino';

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    levelFirst: true,
    translateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'",
    ignore: 'pid,hostname',
  },
});

const logger = pino(
  {
    name: 'websocket-presence',
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  },
  transport
);

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error | unknown, ...args: any[]): void;
  success(message: string, ...args: any[]): void;
}

const customLogger: Logger = {
  debug: (message: string, ...args: any[]) => 
    logger.debug(args.length ? args[0] : undefined, message),
  
  info: (message: string, ...args: any[]) => 
    logger.info(args.length ? args[0] : undefined, message),
  
  warn: (message: string, ...args: any[]) => 
    logger.warn(args.length ? args[0] : undefined, message),
  
  error: (message: string, error?: Error | unknown, ...args: any[]) => {
    if (error instanceof Error) {
      logger.error({ err: error, ...args.length ? args[0] : {} }, message);
    } else if (error) {
      logger.error({ err: new Error(String(error)), ...args.length ? args[0] : {} }, message);
    } else {
      logger.error(args.length ? args[0] : undefined, message);
    }
  },
  
  success: (message: string, ...args: any[]) => 
    logger.info(args.length ? args[0] : undefined, `✨ ${message}`),
};

export default customLogger;