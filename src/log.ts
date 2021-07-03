import winston from 'winston';
import DiscordTransport from 'winston-discordjs';
import { Client, TextChannel } from 'discord.js';

let winLogger;
const config: winston.LoggerOptions = {
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

const createLogger = (discordClient: Client, discordChannel: TextChannel): winston.Logger => {
  const withDiscord: winston.LoggerOptions = {
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
        discordChannel,
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
};

const logger = winLogger;
export { createLogger, logger };
