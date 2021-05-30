import winston from 'winston';
import DiscordTransport from 'winston-discordjs';
import { Client } from 'discord.js';

let winLogger;
const config: any = {
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.splat(),
        winston.format.simple(),
      ),
      level: 'error',
      stderrLevels: ['error'],
    }),
  ],
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.splat(),
        winston.format.simple(),
      ),
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

export function createLogger(discordClient: Client) {
  const withDiscord: any = {
    exceptionHandlers: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.splat(),
          winston.format.simple(),
        ),
        level: 'error',
        stderrLevels: ['error'],
      }),
    ],
    format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
    transports: [
      new DiscordTransport({
        discordClient,
        discordChannel: '848648942740963338',
      }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.splat(),
          winston.format.simple(),
        ),
        stderrLevels: ['error'],
      }),
    ],
  };
  if (process.env.NODE_ENV === 'production') {
    return winston.createLogger({
      level: 'info',
      ...withDiscord,
    });
  }
  return winston.createLogger({
    level: 'silly',
    ...config,
  });
}
export const logger = winLogger;
