import 'reflect-metadata';
require('dotenv').config();
import { Connection, createConnection } from 'typeorm';
import EventEmitter = NodeJS.EventEmitter;
import { Client } from 'discord.js';
import VoiceLogHandler from "./VoiceLog";

export class SassyBot extends EventEmitter {
  public discordClient: Client;
  public dbConnection: Connection;

  constructor(connection: Connection) {
    super();
    this.discordClient = new Client();
    this.dbConnection = connection;
  }

  public eventNames(): Array<string | symbol> {
    const discordEvents = this.discordClient.eventNames();
    return discordEvents.concat(['preLogin', 'postLogin']);
  }

  public async run(): Promise<void> {
    this.emit('preLogin');
    this.discordClient
      .login(process.env.DISCORD_TOKEN)
      .then(console.log)
      .catch(console.error);
    this.emit('postLogin');
  }
}

createConnection().then(async (connection: Connection) => {
  const sb = new SassyBot(connection);
  await VoiceLogHandler(sb);
  await sb.run();
});
