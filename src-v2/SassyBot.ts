import EventEmitter = NodeJS.EventEmitter;
import { Client, GuildMember, Message, MessageMentions } from 'discord.js';
import 'reflect-metadata';
import { Connection, createConnection } from 'typeorm';
import './env';
import VoiceLogHandler from './VoiceLog';

export class SassyBot extends EventEmitter {
  private static isSassyBotCommand(message: Message): boolean {
    return message.cleanContent.startsWith('!sb ') || message.cleanContent.startsWith('!sassybot ');
  }

  private static getCommandParameters(
    message: Message,
  ): { command: string; args: string[]; mentions: MessageMentions | false } {
    const result: {
      args: string[];
      command: string;
      mentions: MessageMentions | false;
    } = {
      args: [],
      command: '',
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
  public dbConnection: Connection;
  protected discordClient: Client;

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
    this.emit('voiceStateUpdate', { client: this.discordClient, oldMember, newMember });
  }
}

createConnection().then(async (connection: Connection) => {
  const sb = new SassyBot(connection);
  await VoiceLogHandler(sb);
  await sb.run();
});
