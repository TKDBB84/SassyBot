/* tslint:disable:ordered-imports */
import './env';

import EventEmitter = NodeJS.EventEmitter;
import { Channel, Client, GuildMember, Message, MessageMentions, User } from 'discord.js';
import 'reflect-metadata';
import { Connection, createConnection } from 'typeorm';
import Dice from './Dice';
import VoiceLogHandler from './VoiceLog';

export interface ISassyBotCommandParams {
  command: string;
  args: string;
  mentions: MessageMentions | false;
}

export class SassyBot extends EventEmitter {
  private static isSassyBotCommand(message: Message): boolean {
    return message.cleanContent.startsWith('!sb ') || message.cleanContent.startsWith('!sassybot ');
  }

  private static getCommandParameters(message: Message): ISassyBotCommandParams {
    const result: {
      args: string;
      command: string;
      mentions: MessageMentions | false;
    } = {
      args: '',
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
        result.args = matches.groups.args;
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

  public getChannel(channelId: string): Channel | null {
    const channel = this.discordClient.channels.get(channelId);
    if (channel) {
      return channel;
    }
    return null;
  }

  public async fetchUser(userId: string): Promise<User | null> {
    const user = await this.discordClient.fetchUser(userId);
    if (user) {
      return user;
    }
    return null;
  }

  public eventNames(): Array<string | symbol> {
    return [
      'preLogin',
      'postLogin',
      'messageReceived',
      'sassybotCommandPreprocess',
      'sassybotCommand',
      'sassybotCommandPostprocess',
      'messageEnd',
      'voiceStateUpdate',
    ];
  }

  public async run(): Promise<void> {
    this.discordClient.on('message', this.onMessageHandler);
    this.discordClient.on('voiceStateUpdate', this.onVoiceStateUpdateHandler);
    this.discordClient.on('disconnect', () => {
      setTimeout(this.login, 30000);
    });
    this.login();
  }

  private async login() {
    this.emit('preLogin');
    this.discordClient
      .login(process.env.DISCORD_TOKEN)
      .then(console.log)
      .catch(console.error);
    this.emit('postLogin');
  }

  private async onMessageHandler(message: Message) {
    this.emit('messageReceived', { message });
    if (SassyBot.isSassyBotCommand(message)) {
      this.emit('sassybotCommandPreprocess', { message });
      this.emit('sassybotCommand', { message, params: SassyBot.getCommandParameters(message) });
      this.emit('sassybotCommandPostprocess', { message });
    }
    this.emit('messageEnd', { message });
  }

  private async onVoiceStateUpdateHandler(oldMember: GuildMember, newMember: GuildMember) {
    this.emit('voiceStateUpdate', { oldMember, newMember });
  }
}

createConnection().then(async (connection: Connection) => {
  const sb = new SassyBot(connection);
  await VoiceLogHandler(sb);
  await Dice.init(sb);
  await sb.run();
});
