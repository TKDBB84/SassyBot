import {
  Channel,
  Client,
  GuildMember,
  Message,
  MessageMentions,
  MessageReaction,
  Role,
  TextChannel,
  User,
  UserResolvable,
  VoiceChannel,
} from 'discord.js';
import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import 'reflect-metadata';
import { Connection, createConnection } from 'typeorm';
import jobs from './cronJobs';
import SassybotEventsToRegister from './sassybotEventListeners';
import SassybotCommand from './sassybotEventListeners/sassybotCommands/SassybotCommand';
import Migrate from './migrate'

export interface ISassybotEventListener {
  event: string;
  getEventListener: () => (...args: any) => Promise<void>;
}

export interface ISassybotCommandParams {
  command: string;
  args: string;
  mentions: MessageMentions | false;
}

export class Sassybot extends EventEmitter {
  private static isSassybotCommand(message: Message): boolean {
    return message.cleanContent.startsWith('!sb ') || message.cleanContent.startsWith('!sassybot ');
  }

  private static getCommandParameters(message: Message): ISassybotCommandParams {
    const result: {
      args: string;
      command: string;
      mentions: MessageMentions | false;
    } = {
      args: '',
      command: '',
      mentions: false,
    };
    const patternMatch = /^(?:!sb\s|!sassybot\s)(?<command>\w+)\s*(?<args>.*)$/i;
    const matches = message.cleanContent.match(patternMatch);
    if (matches && matches.groups) {
      if (matches.groups.command) {
        result.command = matches.groups.command.toLowerCase();
      }
      if (matches.groups.args) {
        result.args = matches.groups.args.toLowerCase().trim();
      }
      if (message.mentions.members.size > 0) {
        result.mentions = message.mentions;
      }
    }
    return result;
  }
  public dbConnection: Connection;
  protected discordClient: Client;
  private registeredCommands = new Set<string>();

  constructor(connection: Connection) {
    super();
    this.discordClient = new Client({ disableEveryone: true });
    this.dbConnection = connection;
  }

  public async getRole(guildId: string, roleId: string): Promise<Role | undefined> {
    let role;
    const guild = this.discordClient.guilds.get(guildId);
    if (guild) {
      role = guild.roles.get(roleId);
    }
    return role;
  }

  public getChannel(channelId: string): Channel | null {
    const channel = this.discordClient.channels.get(channelId);
    if (channel) {
      return channel;
    }
    return null;
  }

  public getTextChannel(channelId: string): TextChannel | null {
    const channel = this.getChannel(channelId);
    if (this.isTextChannel(channel)) {
      return channel;
    }
    return null;
  }

  public async getUser(userId: string): Promise<User | undefined> {
    let user = this.discordClient.users.get(userId);
    if (!user) {
      user = await this.discordClient.fetchUser(userId);
    }
    return user;
  }

  public async getMember(guildId: string, userResolvable: UserResolvable): Promise<GuildMember | undefined> {
    let member;
    const guild = this.discordClient.guilds.get(guildId);
    if (guild) {
      member = guild.member(userResolvable);
      if (!member) {
        member = guild.fetchMember(userResolvable);
      }
    }
    return member;
  }

  public isVoiceChannel(channel: Channel | null): channel is VoiceChannel {
    return !!channel && channel.type === 'voice';
  }

  public isTextChannel(channel: Channel | null): channel is TextChannel {
    return !!channel && channel.type === 'text';
  }

  public isSassyBotCommand(sbEvent: ISassybotEventListener): sbEvent is SassybotCommand {
    return 'command' in sbEvent;
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
      'messageReactionAdd',
      'voiceStateUpdate',
    ];
  }

  public async run(): Promise<void> {
    this.discordClient.on('message', this.onMessageHandler.bind(this));
    this.discordClient.on('voiceStateUpdate', this.onVoiceStateUpdate.bind(this));
    this.discordClient.on('messageReactionAdd', this.onMessageReactionAdd.bind(this));
    this.discordClient.on('guildMemberAdd', this.onGuildMemberAdd.bind(this));
    this.discordClient.on('disconnect', async () => {
      setTimeout(async () => await this.login(), 30000);
    });
    await this.login();
  }

  public registerSassybotEventListener(sbEvent: ISassybotEventListener) {
    if (this.isSassyBotCommand(sbEvent)) {
      if (this.registeredCommands.has(sbEvent.command)) {
        throw new Error('Command Already Registered');
      }
      this.registeredCommands.add(sbEvent.command);
    }
    this.on(sbEvent.event, sbEvent.getEventListener());
  }

  private async login() {
    this.emit('preLogin');
    const loginResult = await this.discordClient.login(process.env.DISCORD_TOKEN);
    console.log({ loginComplete: loginResult });
    this.emit('postLogin');
  }

  private async onMessageHandler(message: Message) {
    if (message.author.bot) {
      return;
    }
    this.emit('messageReceived', { message });
    if (Sassybot.isSassybotCommand(message)) {
      this.emit('sassybotCommandPreprocess', { message });
      const params = Sassybot.getCommandParameters(message);
      if (params.command === 'help') {
        this.processHelpCommand(message, params);
      }
      this.emit('sassybotCommand', { message, params });
      this.emit('sassybotCommandPostprocess', { message });
    }
    this.emit('messageEnd', { message });
  }

  private async processHelpCommand(message: Message, params: ISassybotCommandParams) {
    if (params.args === '') {
      message.channel.send(
        `Available commands are:\n${[...this.registeredCommands]
          .sort()
          .join(
            ', ',
          )}\n for more information, you can specify \`!{sassybot|sb} help [command]\` to get more information about that command`,
        {
          split: true,
        },
      );
    } else if (params.args === 'help') {
      message.channel.send(
        'usage: `!{sassybot|sb} help [command]` -- I displays a list of commands, and can take a 2nd argument for more details of a command',
        {
          split: true,
        },
      );
    }
  }

  private async onGuildMemberAdd(member: GuildMember) {
    if (member.user.bot) {
      return;
    }
    this.emit('guildMemberAdd', { member });
  }

  private async onVoiceStateUpdate(oldMember: GuildMember, newMember: GuildMember) {
    this.emit('voiceStateUpdate', { oldMember, newMember });
  }
  private async onMessageReactionAdd(messageReaction: MessageReaction, user: User) {
    if (messageReaction.message.author.bot) {
      return;
    }
    this.emit('messageReactionAdd', { messageReaction, user });
  }
}

let dbConnection;
if (process.env.NODE_ENV !== 'production') {
  dbConnection = createConnection({
    database: 'sassybot',
    entities: ['dist/entity/**/*.js', 'src/entity/**/*.ts'],
    host: 'localhost',
    logging: true,
    password: 'sassy123',
    port: 3306,
    synchronize: false,
    type: 'mariadb',
    username: 'sassybot',
  });
} else {
  dbConnection = createConnection();
}

dbConnection.then(async (connection: Connection) => {
  const sb = new Sassybot(connection);
  if (process.env.MIGRATE_OLD_DB) {
    const migrate = new Migrate(sb);
    await migrate.migrateAll();
  }

  SassybotEventsToRegister.forEach((event) => sb.registerSassybotEventListener(new event(sb)));
  jobs.forEach(({ job, schedule }) => {
    cron.schedule(schedule, job.bind(null, sb));
  });
  await sb.run();
});
