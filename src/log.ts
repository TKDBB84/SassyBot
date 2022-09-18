import DiscordTransport from 'winston-discordjs';
import { Client, TextChannel } from 'discord.js';
import { format, transports, createLogger as createWinstonLogger } from 'winston';
import type { Logger } from 'winston';
import { consoleFormat } from 'winston-console-format';

const winLogger = createWinstonLogger({
  defaultMeta: { service: 'sassybot' },
  level: 'debug',
  format: format.combine(
    format.timestamp(),
    format.ms(),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  ),
  transports: [
    new transports.Console({
      consoleWarnLevels: ['warning', 'notice'],
      stderrLevels: ['error', 'emerg', 'alert', 'crit'],
      level: 'info',
      handleExceptions: true,
      handleRejections: true,
      format: format.combine(
        format.colorize({ all: true }),
        format.padLevels(),
        consoleFormat({
          showMeta: true,
          metaStrip: ['service'],
          inspectOptions: {
            depth: Infinity,
            colors: true,
            maxArrayLength: Infinity,
            breakLength: 120,
            compact: Infinity,
          },
        }),
      ),
    }),
  ],
});

const createLogger = (discordClient: Client, discordChannel: TextChannel): Logger => {
  if (process.env.NODE_ENV === 'production') {
    return winLogger.add(
      new DiscordTransport({
        discordClient,
        discordChannel,
        level: 'warning',
      }),
    );
  }
  return winLogger;
};

const logger = winLogger;
export { createLogger, logger };
