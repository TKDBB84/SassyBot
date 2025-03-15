import {
  Channel,
  TextChannel,
  Client,
  Guild,
  GuildMember,
  GatewayIntentBits,
  Message,
  MessageMentions,
  MessageReaction,
  PartialGuildMember,
  PartialUser,
  PermissionResolvable,
  Role,
  Snowflake,
  User,
  UserResolvable,
  VoiceState,
  PartialMessageReaction,
  PartialMessage,
} from 'discord.js';
import Redis from 'ioredis';
import EventEmitter from 'events';
import type TypedEmitter from 'typed-emitter';
import cron from 'node-cron';
import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import getDataSource from './dataSource';
import jobs from './cronJobs';
import COTMember from './entity/COTMember';
import FFXIVChar from './entity/FFXIVChar';
import SbUser from './entity/SbUser';
import { logger } from './log';
import SassybotEventsToRegister from './sassybotEventListeners';
import SassybotCommand from './sassybotEventListeners/sassybotCommands/SassybotCommand';
import { NewUserChannels, SassybotLogChannelId, UserIds } from './consts';
import SassybotEventListener from './sassybotEventListeners/SassybotEventListener';

const redisClient = new Redis(6379, process.env.REDIS_HOST || 'localhost');
const redisConnection: Promise<Redis> = new Promise((resolve) => {
  redisClient.on('connect', () => resolve(redisClient));
});

export type SassybotEvent =
  | 'preLogin'
  | 'postLogin'
  | 'messageReceived'
  | 'sassybotCommandPreprocess'
  | 'sassybotCommand'
  | 'sassybotHelpCommand'
  | 'sassybotCommandPostprocess'
  | 'messageEnd'
  | 'messageReactionAdd'
  | 'voiceStateUpdate'
  | 'messageCreate'
  | 'messageUpdate'
  | 'guildMemberAdd';

export interface ISassybotEventListener {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEventListener: () => (...args: any[]) => Promise<void>;
}

export interface ISassybotCommandParams {
  command: string;
  args: string;
  mentions: MessageMentions | false;
}

export type XIVAPIPagination = {
  Page: number;
  PageNext: string | null;
  PagePrev: string | null;
  PageTotal: number;
  Results: number;
  ResultsPerPage: number;
  ResultsTotal: number;
};
export type XIVAPICharacterSearchResult = {
  Avatar: string;
  FeastMatches: number;
  ID: number;
  Lang: string;
  Name: string;
  Rank: string | null;
  RankIcon: string | null;
  Server: string;
};
export type XIVAPISearchResponse = {
  Pagination: XIVAPIPagination;
  Results: XIVAPICharacterSearchResult[];
};
type SassybotEmitter = {
  preLogin: () => void;
  postLogin: () => void;
  messageReceived: ({ message }: { message: Message | PartialMessage }) => void;
  sassybotCommandPreprocess: ({ message }: { message: Message | PartialMessage }) => void;
  sassybotCommand: ({ message, params }: { message: Message | PartialMessage; params: ISassybotCommandParams }) => void;
  sassybotHelpCommand: ({ message, params }: { message: Message; params: ISassybotCommandParams }) => void;
  sassybotCommandPostprocess: ({ message }: { message: Message | PartialMessage }) => void;
  messageEnd: ({ message }: { message: Message | PartialMessage }) => void;
  messageReactionAdd: ({
    messageReaction,
    user,
  }: {
    messageReaction: MessageReaction | PartialMessageReaction;
    user: User | PartialUser;
  }) => void;
  voiceStateUpdate: ({
    previousMemberState,
    currentMemberState,
  }: {
    previousMemberState: VoiceState;
    currentMemberState: VoiceState;
  }) => void;
  messageCreate: () => void;
  messageUpdate: () => void;
  guildMemberAdd: ({ member }: { member: GuildMember | PartialGuildMember }) => void;
};

declare interface SassybotType {
  dbConnection: DataSource;
  logger: typeof logger;
  getRedis(): Promise<Redis>;
  getSasner(): Promise<User>;
  getGuild(guildId: string): Guild | null;
  getRole(guildId: string, roleId: string): Promise<Role | null>;
  getTextChannel(channelId: string): Promise<TextChannel | null>;
  getMessage(channelId: string, messageId: string): Promise<Message | null>;
  maybeCreateSBUser(userId: string): Promise<SbUser>;
  getUser(userId: string): Promise<User | undefined>;
  findCoTMemberByDiscordId(discordId: Snowflake): Promise<COTMember | null>;
  getMember(guildId: string, userResolvable: UserResolvable): Promise<GuildMember | undefined>;
  isTextChannel(channel: Channel | null | undefined): channel is TextChannel;
  isSassyBotCommand(sbEvent: ISassybotEventListener): sbEvent is SassybotCommand;
  botHasPermission(permissionString: PermissionResolvable, guildId: Snowflake): Promise<boolean>;
  eventNames(): (string | symbol)[];
  run(): Promise<void>;
  registerSassybotEventListener(sbEvent: SassybotEventListener): void;
  sendEventMessage(eventName: string, data: Record<string, unknown>): Promise<void>;
}

export class Sassybot extends (EventEmitter as new () => TypedEmitter<SassybotEmitter>) implements SassybotType {
  private static isSassybotCommand(message: Message): boolean {
    const hasCommandPrefix =
      message.cleanContent.toLowerCase().startsWith('!sb ') ||
      message.cleanContent.toLowerCase().startsWith('!sassybot ');
    const isNewUserChannel = Object.values(NewUserChannels).includes(message.channel.id);
    return hasCommandPrefix && !isNewUserChannel;
  }

  private static getCommandParameters(message: Message): ISassybotCommandParams {
    const result: ISassybotCommandParams = {
      args: '',
      command: '',
      mentions: false,
    };
    const patternMatch = /^(?:!sb\s|!sassybot\s)(?<command>\w+)\s*(?<args>.*)$/i;
    const matches = patternMatch.exec(message.cleanContent);
    if (matches && matches.groups) {
      if (matches.groups.command) {
        result.command = matches.groups.command.toLowerCase();
      }
      if (matches.groups.args) {
        result.args = matches.groups.args.toLowerCase().trim();
      }

      if ((message.mentions.members?.size || 0) > 0) {
        result.mentions = message.mentions;
      }
    }
    return result;
  }
  public dbConnection: DataSource;
  public logger: typeof logger;
  private discordClient: Client<true>;
  private registeredCommands: Set<string> = new Set<string>();
  private sasner: User | undefined;

  constructor(connection: DataSource, discordClient: Client<true>) {
    super();
    this.discordClient = discordClient;
    this.dbConnection = connection;
    this.logger = logger;
  }

  public async getRedis(): Promise<Redis> {
    return redisConnection;
  }

  public async getSasner(): Promise<User> {
    if (this.sasner) {
      return this.sasner;
    }
    const sasner = await this.getUser(UserIds.SASNER);
    if (sasner) {
      this.sasner = sasner;
      return sasner;
    }
    throw new Error('Could Not Fetch Sasner?');
  }

  public getGuild(guildId: string): Guild | null {
    return this.discordClient.guilds.resolve(guildId);
  }

  public async getRole(guildId: string, roleId: string): Promise<Role | null> {
    try {
      const guild = this.discordClient.guilds.cache.get(guildId);
      if (!guild) {
        return null;
      }
      return await guild.roles.fetch(roleId);
    } catch (error) {
      this.logger.warn('could not fetch role', { guildId, roleId });
      throw error;
    }
  }

  public async getTextChannel(channelId: string): Promise<TextChannel | null> {
    let channel: Channel | undefined | null = this.discordClient.channels.cache.get(channelId);
    if (!channel) {
      channel = await this.discordClient.channels.fetch(channelId);
    }
    if (this.isTextChannel(channel)) {
      return channel;
    }
    return null;
  }

  public async getMessage(channelId: string, messageId: string): Promise<Message | null> {
    const channel = await this.getTextChannel(channelId);
    if (channel) {
      const message = await channel.messages.fetch(messageId);
      if (message) {
        return message;
      }
    }
    return null;
  }

  public async maybeCreateSBUser(userId: string): Promise<SbUser> {
    const userRepo = this.dbConnection.getRepository<SbUser>(SbUser);
    let sbUser = await userRepo.findOneBy({ discordUserId: userId });
    if (!sbUser) {
      sbUser = await userRepo.save(userRepo.create({ discordUserId: userId }), { reload: true });
    }
    return sbUser;
  }

  public async getUser(userId: string): Promise<User | undefined> {
    try {
      let user = this.discordClient.users.cache.get(userId);
      if (!user) {
        user = await this.discordClient.users.fetch(userId);
      }
      return user;
    } catch (error) {
      this.logger.error('could not fetch user', { userId });
      throw error;
    }
  }
  public async findCoTMemberByDiscordId(discordId: Snowflake): Promise<COTMember | null> {
    const sbUser = await this.maybeCreateSBUser(discordId);
    const char = await this.dbConnection
      .getRepository(FFXIVChar)
      .findOne({ where: { user: { discordUserId: sbUser.discordUserId } } });
    if (!char) {
      return null;
    }

    const member = await this.dbConnection.getRepository(COTMember).findOne({ where: { character: { id: char.id } } });
    char.user = sbUser;
    if (member) {
      member.character = char;
      return member;
    }
    return null;
  }

  public async getMember(guildId: string, userResolvable: UserResolvable): Promise<GuildMember | undefined> {
    try {
      let member;
      const guild = this.discordClient.guilds.cache.get(guildId);
      if (guild) {
        member = await guild.members.fetch(userResolvable);
      }
      return member;
    } catch (error) {
      this.logger.error(`could not fetch member - discordId: ${userResolvable.toString()}`);
      throw error;
    }
  }

  public isTextChannel(channel: Channel | null | undefined): channel is TextChannel {
    return channel instanceof TextChannel;
  }

  public isSassyBotCommand(sbEvent: ISassybotEventListener): sbEvent is SassybotCommand {
    return 'commands' in sbEvent;
  }

  public async botHasPermission(permissionString: PermissionResolvable, guildId: Snowflake): Promise<boolean> {
    const sassybot = this.discordClient.user;
    if (sassybot && guildId) {
      const sbUser = await this.getMember(guildId, sassybot);
      if (sbUser) {
        return sbUser.permissions.has(permissionString);
      }
    }
    return false;
  }

  public eventNames(): (string | symbol)[] {
    return [
      'preLogin',
      'postLogin',
      'messageReceived',
      'sassybotCommandPreprocess',
      'sassybotCommand',
      'sassybotHelpCommand',
      'sassybotCommandPostprocess',
      'messageEnd',
      'messageReactionAdd',
      'voiceStateUpdate',
    ];
  }

  public async run(): Promise<void> {
    this.discordClient.on('messageCreate', (...args) => {
      void this.onMessageHandler.bind(this)(...args);
    });
    this.discordClient.on('messageUpdate', (oldMessage, newMessage) => {
      void this.onMessageHandler.bind(this)(newMessage);
    });

    this.discordClient.on('voiceStateUpdate', (...args) => {
      void this.onVoiceStateUpdate.bind(this)(...args);
    });

    this.discordClient.on('messageReactionAdd', (...args) => {
      void this.onMessageReactionAdd.bind(this)(...args);
    });
    this.discordClient.on('guildMemberAdd', (...args) => {
      void this.onGuildMemberAdd.bind(this)(...args);
    });
    this.discordClient.on('disconnect', () => {
      setTimeout(() => {
        void this.login();
      }, 30000);
    });
    await this.login();
  }

  public registerSassybotEventListener(sbEvent: SassybotEventListener): void {
    const uniqueCommands = new Set();
    if (this.isSassyBotCommand(sbEvent)) {
      sbEvent.commands.forEach((eachCommand) => {
        const thisCommand = eachCommand.toLowerCase();
        if (uniqueCommands.has(thisCommand)) {
          throw new Error('Command Already Registered');
        }
        uniqueCommands.add(thisCommand);
      });
      const command = sbEvent.commands[0].toLowerCase();
      this.registeredCommands.add(command);
    }
  }

  private async login() {
    this.emit('preLogin');
    try {
      await this.discordClient.login(process.env.DISCORD_TOKEN);
      const logChannel = (await this.discordClient.channels.fetch(SassybotLogChannelId)) as TextChannel;
      if (logChannel && this.isTextChannel(logChannel)) {
        this.logger.info('Bot Restarted');
        await logChannel.send('Bot Restarted');
      }
      this.emit('postLogin');
    } catch (error) {
      this.logger.error('Could not login to discord', error);
    }
  }

  private async onMessageHandler(message: Message | PartialMessage): Promise<void> {
    if (!message || message.partial || message?.author?.bot) {
      return;
    }

    this.emit('messageReceived', { message });
    if (Sassybot.isSassybotCommand(message)) {
      try {
        void (await this.maybeCreateSBUser(message.author.id));
      } catch (e) {
        this.logger.warn('Error Creating SbUser', e);
      }
      this.emit('sassybotCommandPreprocess', { message });
      const params = Sassybot.getCommandParameters(message);
      if (params.command === 'help') {
        await this.processHelpCommand(message, params);
      } else {
        this.emit('sassybotCommand', { message, params });
      }
      this.emit('sassybotCommandPostprocess', { message });
    }
    this.emit('messageEnd', { message });
  }

  private async processHelpCommand(message: Message, params: ISassybotCommandParams) {
    if (params.args === '') {
      const commands: string[] = [...this.registeredCommands];
      commands.sort();
      await message.channel.send({
        content: `Available commands are:\n${commands.join(
          ', ',
        )}\n for more information, you can specify \`!{sassybot|sb} help [commands]\` to get more information about that commands`,
      });
    } else if (params.args === 'help') {
      await message.channel.send({
        content:
          'usage: `!{sassybot|sb} help [commands]` -- I displays a list of commands, and can take a 2nd argument for more details of a commands',
      });
    } else {
      this.emit('sassybotHelpCommand', { message, params });
    }
  }

  private onGuildMemberAdd(member: GuildMember | PartialGuildMember) {
    if (member && member.user && member.user.bot) {
      return;
    }
    this.emit('guildMemberAdd', { member });
  }

  private onVoiceStateUpdate(previousMemberState: VoiceState, currentMemberState: VoiceState) {
    if (previousMemberState.member?.user.bot || currentMemberState.member?.user.bot) {
      return;
    }
    this.emit('voiceStateUpdate', { previousMemberState, currentMemberState });
  }
  private onMessageReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (reaction instanceof MessageReaction && user instanceof User) {
      if (reaction.message.author?.bot || user.bot) {
        return;
      }
      this.emit('messageReactionAdd', { messageReaction: reaction, user });
    }
  }

  public async sendEventMessage(eventName: string, data: Record<string, unknown>): Promise<void> {
    const redis = await this.getRedis();
    await redis.publish(
      'sassybot-events',
      JSON.stringify({
        ...data,
        eventName,
      }),
    );
  }
}

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildEmojisAndStickers,
  GatewayIntentBits.GuildIntegrations,
  GatewayIntentBits.GuildWebhooks,
  GatewayIntentBits.GuildInvites,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildMessageTyping,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.DirectMessageReactions,
  GatewayIntentBits.DirectMessageTyping,
  GatewayIntentBits.GuildScheduledEvents,
  GatewayIntentBits.MessageContent,
];
const discordClient = new Client({ intents, allowedMentions: { parse: ['users', 'roles'], repliedUser: true } });
const waitForReady: Promise<Client<true>> = new Promise((resolve, reject) => {
  discordClient.once('ready', () => {
    resolve(discordClient as Client<true>);
  });
  discordClient.once('error', (error) => {
    reject(error);
  });
});
discordClient.login(process.env.DISCORD_TOKEN);

Promise.all([getDataSource(), waitForReady])
  .then(async ([connection, discordClient]: [DataSource, Client<true>]) => {
    if (discordClient.isReady()) {
      const sb = new Sassybot(connection, discordClient);
      sb.setMaxListeners(30);
      SassybotEventsToRegister.forEach((event) => sb.registerSassybotEventListener(new event(sb)));
      jobs.forEach(({ job, schedule }) => {
        const jobFunction = job.bind(null, sb);
        cron.schedule(schedule, () => {
          void jobFunction();
        });
      });
      await sb.run();
    } else {
      throw new Error('client did not connect');
    }
  })
  .catch((e) => {
    logger.error('error connecting to database', e);
  });
