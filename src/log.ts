import * as winston from 'winston';

let winLogger;
const config = {
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.simple()),
      level: 'error',
      stderrLevels: ['error'],
    }),
  ],
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.simple()),
      stderrLevels: ['error'],
    }),
  ],
};
if (process.env.NODE_ENV === 'production') {
  winLogger = winston.createLogger({
    level: 'info',
    ...config,
  });
} else {
  winLogger = winston.createLogger({
    level: 'silly',
    ...config,
  });
}

export const logger = winLogger;
