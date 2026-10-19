import {
  Channel,
  ChatInputCommandInteraction,
  TextChannel,
  Client,
  Events,
  Guild,
  GuildMember,
  GatewayIntentBits,
  Interaction,
  Message,
  MessageFlags,
  MessageReaction,
  PartialGuildMember,
  PartialUser,
  PermissionResolvable,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  Role,
  SlashCommandBuilder,
  Snowflake,
  User,
  UserResolvable,
  VoiceState,
  PartialMessageReaction,
  MessageReactionEventDetails,
} from 'discord.js';
import Redis from 'ioredis';
import EventEmitter from 'node:events';
import type TypedEmitter from 'typed-emitter';
import cron from 'node-cron';
import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import getDataSource from './dataSource';
import jobs from './cronJobs';
import SbUser from './entity/SbUser';
import { createLogger, logger } from './log';
import SassybotEventsToRegister from './sassybotEventListeners';
import SassybotCommand from './sassybotEventListeners/sassybotCommands/SassybotCommand';
import { NewUserChannels, SassybotLogChannelId, UserIds } from './consts';
import SassybotEventListener from './sassybotEventListeners/SassybotEventListener';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379,
  keepAlive: 10000,
  connectTimeout: 10000,
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    return Math.min(times * 200, 5000);
  },
  reconnectOnError(err: Error) {
    const errWithCode = err as Error & { code?: string };
    const reconnectCodes = ['ECONNRESET', 'ECONNREFUSED'];
    if (errWithCode.code && reconnectCodes.includes(errWithCode.code)) {
      return true;
    }
    return err.message.includes('READONLY');
  },
});

redisClient.on('error', (err: Error) => {
  logger.error('Redis client error', err);
});
redisClient.on('reconnecting', (delay: number) => {
  logger.warn('Redis client reconnecting...', { delay });
});

const REDIS_READY_TIMEOUT_MS = 30_000;

const redisConnection: Promise<Redis> = new Promise((resolve, reject) => {
  if (redisClient.status === 'ready') {
    resolve(redisClient);
    return;
  }
  const onReady = () => {
    clearTimeout(timer);
    resolve(redisClient);
  };
  const timer = setTimeout(() => {
    redisClient.removeListener('ready', onReady);
    reject(new Error('Timed out waiting for Redis to become ready'));
  }, REDIS_READY_TIMEOUT_MS);
  redisClient.once('ready', onReady);
});

export type SassybotEvent =
  | 'preLogin'
  | 'postLogin'
  | 'sassybotCommandPreprocess'
  | 'sassybotCommandPostprocess'
  | 'messageReactionAdd'
  | 'voiceStateUpdate'
  | 'guildMemberAdd';

export interface ISassybotEventListener {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEventListener: () => (...args: any[]) => Promise<void>;
}

type SassybotEmitter = {
  preLogin: () => void;
  postLogin: () => void;
  sassybotCommandPreprocess: ({ interaction }: { interaction: ChatInputCommandInteraction }) => void;
  sassybotCommandPostprocess: ({ interaction }: { interaction: ChatInputCommandInteraction }) => void;
  messageReactionAdd: ({
    messageReaction,
    user,
    details,
  }: {
    messageReaction: MessageReaction | PartialMessageReaction;
    user: User | PartialUser;
    details: MessageReactionEventDetails;
  }) => void;
  voiceStateUpdate: ({
    previousMemberState,
    currentMemberState,
  }: {
    previousMemberState: VoiceState;
    currentMemberState: VoiceState;
  }) => void;
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
  public dbConnection: DataSource;
  public logger: typeof logger;
  private discordClient: Client<true>;
  private commandsMap: Map<string, SassybotCommand> = new Map<string, SassybotCommand>();
  private slashCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
  private guildSlashCommands: Map<string, RESTPostAPIChatInputApplicationCommandsJSONBody[]> = new Map();
  private sasner: User | undefined;

  constructor(connection: DataSource, discordClient: Client<true>) {
    super();
    this.discordClient = discordClient;
    this.dbConnection = connection;
    this.logger = logger;
  }

  public async getRedis(): Promise<Redis> {
    await redisConnection;
    return redisClient;
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
      'sassybotCommandPreprocess',
      'sassybotCommandPostprocess',
      'messageReactionAdd',
      'voiceStateUpdate',
      'guildMemberAdd',
    ];
  }

  public async run(): Promise<void> {
    this.discordClient.on(Events.InteractionCreate, (...args) => {
      void this.onInteractionCreate.bind(this)(...args);
    });

    this.discordClient.on(Events.VoiceStateUpdate, (...args) => {
      void this.onVoiceStateUpdate.bind(this)(...args);
    });

    this.discordClient.on(Events.MessageReactionAdd, (...args) => {
      void this.onMessageReactionAdd.bind(this)(...args);
    });
    this.discordClient.on(Events.GuildMemberAdd, (...args) => {
      void this.onGuildMemberAdd.bind(this)(...args);
    });
    await this.login();
  }

  public registerSassybotEventListener(sbEvent: SassybotEventListener): void {
    if (this.isSassyBotCommand(sbEvent)) {
      sbEvent.commands.forEach((eachCommand) => {
        const thisCommand = eachCommand.toLowerCase();
        if (this.commandsMap.has(thisCommand)) {
          throw new Error('Command Already Registered');
        }
        this.commandsMap.set(thisCommand, sbEvent);
      });
      if (sbEvent.guildId) {
        const existing = this.guildSlashCommands.get(sbEvent.guildId) ?? [];
        existing.push(...sbEvent.getSlashCommands());
        this.guildSlashCommands.set(sbEvent.guildId, existing);
      } else {
        this.slashCommands.push(...sbEvent.getSlashCommands());
      }
    }
  }

  private async login() {
    this.emit('preLogin');
    try {
      const globalChoices = [...this.commandsMap.entries()]
        .filter(([, cmd]) => !cmd.guildId)
        .map(([name]) => ({ name: `/${name}`, value: name }))
        .sort((a, b) => a.value.localeCompare(b.value));

      const helpCommand = new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display a list of available commands or details about a specific command')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('The command to get help for')
            .setRequired(false)
            .addChoices(...globalChoices.slice(0, 25)),
        )
        .toJSON();
      await this.discordClient.application.commands.set([helpCommand, ...this.slashCommands]);

      for (const [guildId, commands] of this.guildSlashCommands.entries()) {
        await this.discordClient.application.commands.set(commands, guildId);
      }

      const logChannel = (await this.discordClient.channels.fetch(SassybotLogChannelId)) as TextChannel;
      if (logChannel && this.isTextChannel(logChannel)) {
        this.logger = createLogger(this.discordClient, logChannel);
        this.logger.info('Bot Restarted');
        await logChannel.send('Bot Restarted');
      }
      this.emit('postLogin');
    } catch (error) {
      this.logger.error('Could not login to discord', error);
    }
  }

  private async onInteractionCreate(interaction: Interaction): Promise<void> {
    if (interaction.user.bot) {
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = this.commandsMap.get(interaction.commandName.toLowerCase());
      if (command) {
        try {
          await command.autocomplete({ interaction });
        } catch (e) {
          this.logger.warn(`Error handling autocomplete for ${interaction.commandName}`, e);
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }
    if (Object.values(NewUserChannels).includes(interaction.channelId)) {
      await interaction.reply({
        content: 'Commands cannot be used in this channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    try {
      void (await this.maybeCreateSBUser(interaction.user.id));
    } catch (e) {
      this.logger.warn('Error Creating SbUser', e);
    }
    this.emit('sassybotCommandPreprocess', { interaction });
    if (interaction.commandName === 'help') {
      await this.processHelpCommand(interaction);
    } else {
      const command = this.commandsMap.get(interaction.commandName.toLowerCase());
      if (!command) {
        await interaction.reply({
          content: `Unknown command \`/${interaction.commandName}\`.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (command.guildId && interaction.guildId !== command.guildId) {
        await interaction.reply({
          content: 'This command is not available in this server.',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await command.execute({ interaction });
      }
    }
    this.emit('sassybotCommandPostprocess', { interaction });
  }

  private async processHelpCommand(interaction: ChatInputCommandInteraction) {
    const commandArg = (interaction.options.getString('command') ?? '').toLowerCase().trim().replace(/^\//, '');
    const isVisible = (cmd: SassybotCommand) =>
      !cmd.guildId || (interaction.guildId === cmd.guildId && interaction.user.id === UserIds.SASNER);

    if (commandArg === '') {
      const commands: string[] = [...this.commandsMap.entries()]
        .filter(([, cmd]) => isVisible(cmd))
        .map(([name]) => name);
      commands.sort();
      await interaction.reply({
        content: `Available commands are:\n${commands.map((c) => `\`/${c}\``).join(', ')}\n for more information, you can specify \`/help command:[command]\` to get more information about that command`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (commandArg === 'help') {
      await interaction.reply({
        content:
          'usage: `/help [command]` -- I display a list of commands, and can take an optional argument for more details of a command',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      const command = this.commandsMap.get(commandArg);
      if (command && isVisible(command)) {
        await command.displayHelpText({ interaction });
      } else {
        await interaction.reply({
          content: `Unknown command \`/${commandArg}\`. Run \`/help\` to see available commands.`,
          flags: MessageFlags.Ephemeral,
        });
      }
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
  private onMessageReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    details: MessageReactionEventDetails,
  ) {
    if (reaction instanceof MessageReaction && user instanceof User) {
      if (reaction.message.author?.bot || user.bot) {
        return;
      }
      this.emit('messageReactionAdd', { messageReaction: reaction, user, details });
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
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.MessageContent,
];
logger.info('Creating Discord Client...');
const discordClient = new Client({ intents, allowedMentions: { parse: ['users', 'roles'], repliedUser: true } });
discordClient.on(Events.Error, (err) => {
  logger.error('Discord client error', err);
});
const waitForReady: Promise<Client<true>> = new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(new Error('connection timed out'));
  }, 30_000);
  discordClient.once(Events.ClientReady, (readyClient) => {
    clearTimeout(timer);
    resolve(readyClient);
  });
  discordClient.once(Events.Error, (error) => {
    clearTimeout(timer);
    reject(error);
  });
});

logger.info('Attempting To Connect...');
discordClient.login(process.env.DISCORD_TOKEN).catch((e) => {
  logger.error('Error Logging In', e);
  process.exit(1);
});

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
    process.exit(1);
  });
