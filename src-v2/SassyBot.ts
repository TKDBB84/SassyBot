import 'reflect-metadata';
require('dotenv').config();
import { Connection, createConnection } from 'typeorm';
import EventEmitter = NodeJS.EventEmitter;
import { Client, GuildMember, Message, MessageMentions } from 'discord.js';
import VoiceLogHandler from './VoiceLog';

export class SassyBot extends EventEmitter {
  protected discordClient: Client;
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
    this.discordClient.on('message', this.onMessageHandler);
    this.discordClient.on('voiceStateUpdate', this.onVoiceStateUpdateHandler);
    this.discordClient
      .login(process.env.DISCORD_TOKEN)
      .then(console.log)
      .catch(console.error);
    this.emit('postLogin');
  }

  private async onMessageHandler(message: Message) {
    this.emit('messageReceived', { message });
    if (this.isSassyBotCommand(message)) {
      this.emit('sassybotCommand', { message, params: this.getCommandParameters(message) });
    }
    this.emit('messageEnd', { message });
  }

  private async onVoiceStateUpdateHandler(oldMember: GuildMember, newMember: GuildMember) {
    this.emit('voiceStateUpdate', { client: sb.discordClient, oldMember, newMember });
  }

  private isSassyBotCommand(message: Message): boolean {
    return message.cleanContent.startsWith('!sb ') || message.cleanContent.startsWith('!sassybot ');
  }

  private getCommandParameters(
    message: Message,
  ): { command: string; args: string[]; mentions: MessageMentions | false } {
    let result: {
      command: string;
      args: string[];
      mentions: MessageMentions | false;
    } = {
      command: '',
      args: [],
      mentions: false,
    };
    const patternMatch = /^(?:!sb\s|!sassybot\s)(?<command>\w+)\s(?<args>.*)$/i;
    const matches = message.cleanContent.match(patternMatch);
    if (matches && matches.groups) {
      if (matches.groups.command) {
        result.command = matches.groups.command;
      }
      if (matches.groups.args) {
        result.args = matches.groups.args.split(' ');
      }
      if (message.mentions.members.size > 0) {
        result.mentions = message.mentions;
      }
    }
    return result;
  }
}

createConnection().then(async (connection: Connection) => {
  const sb = new SassyBot(connection);
  await VoiceLogHandler(sb);
  await sb.run();
});
