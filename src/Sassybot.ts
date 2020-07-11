import {
  Channel,
  Client,
  GuildMember,
  Message,
  MessageMentions,
  MessageReaction,
  PartialGuildMember,
  PartialUser,
  PermissionResolvable,
  Role,
  Snowflake,
  TextChannel,
  User,
  UserResolvable,
  VoiceState,
} from 'discord.js';
import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import 'reflect-metadata';
import { Connection, createConnection } from 'typeorm';
import jobs from './cronJobs';
import COTMember from './entity/COTMember';
import FFXIVChar from './entity/FFXIVChar';
import SbUser from './entity/SbUser';
import { logger } from './log';
import SassybotEventsToRegister from './sassybotEventListeners';
import SassybotCommand from './sassybotEventListeners/sassybotCommands/SassybotCommand';

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
    return (
      message.cleanContent.toLowerCase().startsWith('!sb ') ||
      message.cleanContent.toLowerCase().startsWith('!sassybot ')
    );
  }

  private static getCommandParameters(message: Message): ISassybotCommandParams {
    const result: ISassybotCommandParams = {
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

      if ((message.mentions.members?.size || 0) > 0) {
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
    this.discordClient = new Client({ disableMentions: 'everyone' });
    this.dbConnection = connection;
  }

  public async getRole(guildId: string, roleId: string): Promise<Role | null | undefined> {
    try {
      let role;
      const guild = this.discordClient.guilds.cache.get(guildId);
      if (guild) {
        role = guild.roles.cache.get(roleId);
        if (!role) {
          role = await guild.roles.fetch(roleId);
        }
      }
      return role;
    } catch (error) {
      logger.warn('could not fetch role', { roleId, guildId, error });
      throw error;
    }
  }

  public async getChannel(channelId: string): Promise<Channel | null> {
    let channel;
    try {
      channel = this.discordClient.channels.cache.get(channelId);
      if (!channel) {
        channel = await this.discordClient.channels.fetch(channelId);
      }
    } catch (error) {
      logger.warn('could not fetch channel', { channelId, error });
    }
    return channel || null;
  }

  public async getTextChannel(channelId: string): Promise<TextChannel | null> {
    const channel = await this.getChannel(channelId);
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

  public async getUser(userId: string): Promise<User | undefined> {
    try {
      let user = this.discordClient.users.cache.get(userId);
      if (!user) {
        user = await this.discordClient.users.fetch(userId);
      }
      return user;
    } catch (error) {
      logger.warn('could not fetch user', { userId, error });
      throw error;
    }
  }
  public async findCoTMemberByDiscordId(discordId: Snowflake): Promise<COTMember | false> {
    const sbUserRepo = this.dbConnection.getRepository(SbUser);
    let sbUser = await sbUserRepo.findOne(discordId);
    if (!sbUser) {
      sbUser = new SbUser();
      sbUser.discordUserId = discordId;
      await sbUserRepo.save(sbUser);
      return false;
    }
    const char = await this.dbConnection
      .getRepository(FFXIVChar)
      .findOne({ where: { user: { discordUserId: sbUser.discordUserId } } });
    if (!char) {
      return false;
    }

    const member = await this.dbConnection.getRepository(COTMember).findOne({ where: { character: { id: char.id } } });
    char.user = sbUser;
    if (member) {
      member.character = char;
      return member;
    }
    return false;
  }

  public async getMember(guildId: string, userResolvable: UserResolvable): Promise<GuildMember | undefined> {
    try {
      let member;
      const guild = this.discordClient.guilds.cache.get(guildId);
      if (guild) {
        member = guild.member(userResolvable);
        if (!member) {
          member = await guild.members.fetch(userResolvable);
        }
      }
      return member;
    } catch (e) {
      logger.warn('could not fetch member', userResolvable, guildId, e);
      throw e;
    }
  }

  public isTextChannel(channel: Channel | null | undefined): channel is TextChannel {
    return !!channel && channel.type === 'text';
  }

  public isSassyBotCommand(sbEvent: ISassybotEventListener): sbEvent is SassybotCommand {
    return 'commands' in sbEvent;
  }

  public async botHasPermission(permissionString: PermissionResolvable, guildId: Snowflake): Promise<boolean> {
    const sassybot = this.discordClient.user;
    if (sassybot && guildId) {
      const sbUser = await this.getMember(guildId, sassybot);
      if (sbUser) {
        return sbUser.hasPermission(permissionString);
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
    this.on(sbEvent.event, sbEvent.getEventListener().bind(sbEvent));
  }

  private async login() {
    this.emit('preLogin');
    const loginResult = await this.discordClient.login(process.env.DISCORD_TOKEN);
    logger.info('login Complete', { loginResult });
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
      await message.channel.send(
        `Available commands are:\n${commands.join(
          ', ',
        )}\n for more information, you can specify \`!{sassybot|sb} help [commands]\` to get more information about that commands`,
        {
          split: true,
        },
      );
    } else if (params.args === 'help') {
      await message.channel.send(
        'usage: `!{sassybot|sb} help [commands]` -- I displays a list of commands, and can take a 2nd argument for more details of a commands',
        {
          split: true,
        },
      );
    }
  }

  private async onGuildMemberAdd(member: GuildMember | PartialGuildMember) {
    if (member && member.user && member.user.bot) {
      return;
    }
    this.emit('guildMemberAdd', { member });
  }

  private async onVoiceStateUpdate(previousMemberState: VoiceState, currentMemberState: VoiceState) {
    if (previousMemberState.member?.user.bot || currentMemberState.member?.user.bot) {
      return;
    }
    this.emit('voiceStateUpdate', { previousMemberState, currentMemberState });
  }
  private async onMessageReactionAdd(messageReaction: MessageReaction, user: User | PartialUser) {
    if (messageReaction.message.author.bot || user.bot) {
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

  SassybotEventsToRegister.forEach((event) => sb.registerSassybotEventListener(new event(sb)));
  jobs.forEach(({ job, schedule }) => {
    cron.schedule(schedule, job.bind(null, sb));
  });
  await sb.run();
});
