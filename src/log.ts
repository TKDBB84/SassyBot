import DiscordTransport from 'winston-discordjs';
import { Client, TextChannel } from 'discord.js';
import { format, transports, createLogger as createWinstonLogger } from 'winston';
import type { Logger } from 'winston';

const winLogger = createWinstonLogger({
  level: 'debug',
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json(), format.splat()),
  transports: [
    new transports.Console({
      consoleWarnLevels: ['warning', 'notice'],
      stderrLevels: ['error', 'emerg', 'alert', 'crit'],
      level: 'info',
      handleExceptions: true,
      handleRejections: true,
      format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json(), format.splat()),
    }),
  ],
});

let discordTransportAdded = false;

const createLogger = (discordClient?: Client, discordChannel?: TextChannel): Logger => {
  if (discordClient && discordChannel && !discordTransportAdded) {
    winLogger.add(
      new DiscordTransport({
        discordClient,
        discordChannel,
        level: 'warn',
      }),
    );
    discordTransportAdded = true;
  }
  return winLogger;
};

const logger = winLogger;
export { createLogger, logger };
