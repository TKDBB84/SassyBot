import 'reflect-metadata';
require('dotenv').config();
import { Connection, createConnection } from 'typeorm';
import EventEmitter = NodeJS.EventEmitter;
import { Client, Message } from 'discord.js';
import * as fs from 'fs';

export type Command = (message: Message) => void;
export type Import = { functions: { [key: string]: Command }; help: { [key: string]: string } };
export type ImportList = Import[];
export type CommandList = { [key: string]: Command };
export type PleaseRequiredList = { [key: string]: { id: string; lastMessage: Message | null } };
export type TrollCommand = (message: Message) => boolean;
export type TrollList = { process: TrollCommand; chance: number }[];
type client_secrets = { token: string; xivApiToken: string };

const getSecrets: () => client_secrets = (): client_secrets => {
  const fileData = fs.readFileSync('/home/nodebot/src/client_secrets.json');
  return JSON.parse(fileData.toString());
};

export class SassyBot extends EventEmitter {
  protected discordClient: Client;
  public dbConnection: Connection;

  constructor(connection: Connection) {
    super();
    this.discordClient = new Client();
    this.dbConnection = connection;
  }

  private connect(): void {}

  public eventNames(): Array<string | symbol> {
    const discordEvents = this.discordClient.eventNames();
    return discordEvents.concat([
      'preLogin',
      'postLogin',
    ])
  }

  public run(): void {
    this.emit('preLogin', {client: this.discordClient});
    this.discordClient
      .login(getSecrets().token)
      .then(console.log)
      .catch(console.error);
    this.emit('postLogin', {client: this.discordClient});
  }
}

createConnection().then(async (connection: Connection) => {
  const sb = new SassyBot(connection);
  sb.run();
});
