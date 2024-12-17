// src/services/logger.ts
import pino from 'pino';
import { config } from '../config/environment';

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    levelFirst: true,
    translateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'",
    ignore: 'pid,hostname',
  },
});

export const logger = pino(
  {
    name: 'websocket-presence',
    level: config.isDevelopment ? 'debug' : 'info',
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  },
  transport
);

export default {
  debug: (message: string, ...args: any[]) => logger.debug(args.length ? args[0] : undefined, message),
  info: (message: string, ...args: any[]) => logger.info(args.length ? args[0] : undefined, message),
  warn: (message: string, ...args: any[]) => logger.warn(args.length ? args[0] : undefined, message),
  error: (message: string, error?: Error, ...args: any[]) => {
    if (error) {
      logger.error({ err: error, ...args.length ? args[0] : {} }, message);
    } else {
      logger.error(args.length ? args[0] : undefined, message);
    }
  },
  success: (message: string, ...args: any[]) => logger.info(args.length ? args[0] : undefined, `✨ ${message}`),
};