import {
  AnyChannel,
  TextChannel,
  Client,
  Guild,
  GuildMember,
  Intents,
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
} from 'discord.js';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import cron from 'node-cron';
import 'reflect-metadata';
import { Connection, createConnection } from 'typeorm';
import jobs from './cronJobs';
import COTMember from './entity/COTMember';
import FFXIVChar from './entity/FFXIVChar';
import SbUser from './entity/SbUser';
import { createLogger, logger } from './log';
import SassybotEventsToRegister from './sassybotEventListeners';
import SassybotCommand from './sassybotEventListeners/sassybotCommands/SassybotCommand';
import { CoTButtStuffChannelId, NewUserChannels, SassybotLogChannelId, UserIds } from './consts';

const redisClient = new Redis();
const redisConnection: Promise<Redis> = new Promise((resolve) => {
  redisClient.on('connect', () => resolve(redisClient));
});

export interface ISassybotEventListener {
  event: string;
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

export class Sassybot extends EventEmitter {
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
  public dbConnection: Connection;
  public logger: typeof logger;
  protected discordClient: Client;
  private registeredCommands = new Set<string>();
  private sasner: User | undefined;

  constructor(connection: Connection) {
    super();
    const intents = new Intents();
    intents.add(
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MEMBERS,
      Intents.FLAGS.GUILD_BANS,
      Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
      Intents.FLAGS.GUILD_INTEGRATIONS,
      Intents.FLAGS.GUILD_WEBHOOKS,
      Intents.FLAGS.GUILD_INVITES,
      Intents.FLAGS.GUILD_VOICE_STATES,
      Intents.FLAGS.GUILD_PRESENCES,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
      Intents.FLAGS.GUILD_MESSAGE_TYPING,
      Intents.FLAGS.DIRECT_MESSAGES,
      Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
      Intents.FLAGS.DIRECT_MESSAGE_TYPING,
      Intents.FLAGS.GUILD_SCHEDULED_EVENTS
    );
    this.discordClient = new Client({ intents, allowedMentions: { parse: ['users', 'roles'], repliedUser: true } });
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
      this.logger.warn('could not fetch role', [error, guildId, roleId]);
      throw error;
    }
  }

  public async getTextChannel(channelId: string): Promise<TextChannel | null> {
    let channel: AnyChannel | undefined | null = this.discordClient.channels.cache.get(channelId);
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
    let sbUser = await userRepo.findOne({ discordUserId: userId });
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
      this.logger.error('could not fetch user', [error, userId]);
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
      this.logger.error('could not fetch member', [error, guildId, userResolvable]);
      throw error;
    }
  }

  public isTextChannel(channel: AnyChannel | null | undefined): channel is TextChannel {
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
    this.discordClient.on('message', (...args) => {
      void this.onMessageHandler.bind(this)(...args);
    });

    this.discordClient.on('voiceStateUpdate', (...args) => {
      this.logger.info('voiceStateUpdate', args);
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

  public registerSassybotEventListener(sbEvent: ISassybotEventListener): void {
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
      this.on('sassybotHelpCommand', ({ message, params }: { message: Message; params: ISassybotCommandParams }) => {
        void sbEvent.displayHelpText.bind(sbEvent)({ message, params });
      });
    }
    this.on(sbEvent.event, (...args) => {
      void sbEvent.getEventListener().bind(sbEvent)(...args);
    });
  }

  private async login() {
    this.emit('preLogin');
    await this.discordClient.login(process.env.DISCORD_TOKEN);
    const logChannel = (await this.discordClient.channels.fetch(SassybotLogChannelId)) as TextChannel;
    this.logger = createLogger(this.discordClient, logChannel);
    this.logger.info('Bot Restarted');
    const restartMessageChannel = await this.discordClient.channels.fetch(CoTButtStuffChannelId);
    if (restartMessageChannel && this.isTextChannel(restartMessageChannel)) {
      await restartMessageChannel.send('Bot Restarted');
    }
    this.emit('postLogin');
  }

  private async onMessageHandler(message: Message): Promise<void> {
    if (message.author.bot) {
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

dbConnection
  .then(async (connection: Connection) => {
    const sb = new Sassybot(connection);
    sb.setMaxListeners(30);
    SassybotEventsToRegister.forEach((event) => sb.registerSassybotEventListener(new event(sb)));
    jobs.forEach(({ job, schedule }) => {
      const jobFunction = job.bind(null, sb);
      cron.schedule(schedule, () => {
        void jobFunction();
      });
    });
    await sb.run();
  })
  .catch((e) => {
    logger.error('error connecting to database', e);
  });
