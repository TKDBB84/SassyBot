import * as winston from 'winston';
// import DiscordTransport from 'winston-discord-transport';

let winLogger;
const config = {
  exceptionHandlers: [
    // new DiscordTransport({
    //   webhook:
    //     'https://discord.com/api/webhooks/367794012406415360/e_L9nHvvj1_nZYN1sb3pKsk0p2nP_EwE4bMnAlWCMkTotmTAU4R6rrw7H5KJNQT-EpI3',
    //   defaultMeta: { service: 'Sassybot' },
    //   level: 'error',
    // }),
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

export const logger = winLogger;
