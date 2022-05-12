import { Collection, Message, MessageCollector, MessageReaction, Snowflake, User } from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import Event from '../../entity/Event';
import SbUser from '../../entity/SbUser';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { GuildIds } from '../../consts';

declare type repeatingEvent = {
  id: number;
  eventName: string;
  user: { discordUserId: '0' };
  eventTime: Date;
};

export default class EventCommand extends SassybotCommand {
  public readonly commands = ['event', 'events'];

  public getHelpText(): string {
    return (
      'usage:\n' +
      '`!{sassybot|sb} event Some Event` To view the time for "Some Event"\n' +
      '`!{sassybot|sb} event list` to see all scheduled events\n' +
      '`!{sassybot|sb} event create My New Event Name` to create an event, you will be prompted for a Date & Time'
    );
  }

  private static getRepeatingEvents(guildId: string): repeatingEvent[] {
    if (guildId === GuildIds.COT_GUILD_ID) {
      let nextSaturday = moment().startOf('isoWeek').day('saturday').add(15, 'hours');
      const now = moment();
      if (now.isAfter(nextSaturday)) {
        nextSaturday = moment().startOf('isoWeek').add(1, 'week').day('saturday').add(15, 'hours');
      }

      return [
        {
          id: 123456789,
          eventName: "averil's mount farming",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          user: { discordUserId: '0' },
          eventTime: nextSaturday.toDate(),
        },
      ];
    }
    return [];
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (!message.guild || !message.guild.id) {
      await message.reply('cannot create events in private messages!');
      return;
    }
    const guildId = message.guild.id;
    const userRepository = this.sb.dbConnection.getRepository(SbUser);
    let currentUser = await userRepository.findOne({ where: { discordUserId: message.author.id } });
    if (!currentUser) {
      currentUser = new SbUser();
      currentUser.discordUserId = message.author.id;
      currentUser = await userRepository.save(currentUser, { reload: true });
    }
    if (!currentUser.timezone || currentUser.timezone.trim() === 'UTC') {
      await message.channel.send(
        'Sorry, you dont have a timezone registered for yourself, use `!sb tz` to set a timezone',
      );
      return;
    }

    if (
      params.args.trim().toLowerCase() === 'list' ||
      params.args.trim().toLowerCase() === 'all' ||
      params.args.trim() === ''
    ) {
      await this.listAll(message, currentUser.timezone);
      return;
    }

    const compressedArgs = params.args.replace(/\s\s+/g, ' ').trim();
    const matches = /^(create)?\s?(.*)/.exec(compressedArgs);
    const isCreating = matches?.[1] === 'create';
    const eventName = matches?.[2];
    if (!eventName || eventName === '') {
      await message.channel.send('Sorry, you must specify an event name');
      return;
    }

    if (isCreating) {
      await this.createEvent(message, eventName, currentUser.timezone);
      return;
    }

    const event = await Event.findByName(eventName, guildId);
    if (event) {
      const eventMoment = moment.tz(event.eventTime, 'UTC');
      const formattedDate = eventMoment.tz(currentUser.timezone).format('D, MMM [at] LT z');
      const sentMessage = await message.channel.send(`"${eventName}" is happening on ${formattedDate}`);
      if (event.user.discordUserId === message.author.id) {
        this.listenForReaction(sentMessage, message.author.id, event.id);
      }
    } else {
      await message.channel.send('Sorry, I was unable to find an event by that name');
      return;
    }
  }
  private async listAll(message: Message, userTz: string): Promise<void> {
    if (!message.guild || !message.guild.id) {
      await message.reply('cannot create events in private messages!');
      return;
    }
    const guildId = message.guild.id;
    const allEvents = [...(await Event.getAll(guildId)), ...EventCommand.getRepeatingEvents(guildId)];

    if (allEvents && allEvents.length) {
      for (let i = 0, iMax = allEvents.length; i < iMax; i++) {
        const eventMoment = moment.tz(allEvents[i].eventTime, 'UTC');
        const sentMessage = await message.channel.send(
          `"${allEvents[i].eventName}" happening on ${eventMoment.tz(userTz).format('dddd, MMM Do [at] LT z')}`,
        );
        if (allEvents[i].user.discordUserId === message.author.id) {
          this.listenForReaction(sentMessage, message.author.id, allEvents[i].id);
        }
      }
    } else {
      await message.channel.send('No Future Events Scheduled');
    }
  }

  private listenForReaction(sentMessage: Message, authorId: string, eventIdToDelete: number) {
    const reactionCollectorOptions = {
      filter: (reaction: MessageReaction, user: User): boolean => {
        return (reaction.emoji.name === '⛔' || reaction.emoji.name === '🔁') && user.id === authorId;
      },
      max: 1,
      maxEmojis: 1,
      maxUsers: 1,
      time: 300000, // 5 min
    };
    void Promise.all([sentMessage.react('🔁'), sentMessage.react('⛔')]).then(
      ([reactionRepeat, reactionNo]: MessageReaction[]) => {
        const reactionCollector = sentMessage.createReactionCollector(reactionCollectorOptions);
        reactionCollector.on('end', (collected: Collection<Snowflake, MessageReaction>) => {
          const doAsyncWork = async () => {
            await EventCommand.removeReactions([reactionRepeat, reactionNo]);
            if (collected && collected.size > 0) {
              const reaction = collected.first();
              if (reaction?.emoji.name === '⛔') {
                await this.deleteEvent(sentMessage, eventIdToDelete);
              } else if (reaction?.emoji.name === '🔁') {
                // do repeating things
                await sentMessage.channel.send(
                  "Sorry, Sasner hasn't finished the repeating functionality, because he sucks",
                );
              }
            }
          };
          void doAsyncWork();
        });
      },
    );
  }

  private static async removeReactions(reactionsToRemove: MessageReaction[]): Promise<boolean> {
    return !!(await Promise.all(reactionsToRemove.map((reaction: MessageReaction) => reaction.remove())));
  }

  private async deleteEvent(sentMessage: Message, eventIdToDelete: number): Promise<boolean> {
    const toResolve: Promise<Message | true>[] = [];
    const guildId = sentMessage.guild?.id;
    if (guildId) {
      const canDelete = await this.sb.botHasPermission('MANAGE_MESSAGES', guildId);
      if (canDelete) {
        toResolve.push(sentMessage.delete());
      }
      toResolve.push(Event.delete(eventIdToDelete));
    }
    return !!(await Promise.all(toResolve));
  }

  private async createEvent(message: Message, eventName: string, userTz: string) {
    if (!message.guild || !message.guild.id) {
      await message.reply('cannot create events in private messages!');
      return;
    }
    const userRepo = this.sb.dbConnection.getRepository<SbUser>(SbUser);
    const guildId = message.guild.id;
    await message.channel.send(
      'When will the event happen? please use YYYY-MM-DD hh:mm(am/pm) for times i can accept formats like: 3:27pm, 15:27, 03:27pm',
    );
    const validDateFormats = [
      'YYYY-MM-DD h:mma',
      'YYYY-MM-DD hh:mma',
      'YYYY-MM-DD h:mm a',
      'YYYY-MM-DD hh:mm a',
      'YYYY-MM-DD hh:mm',
    ];

    const filter = (filterMessage: Message) => {
      if (filterMessage.author.id !== message.author.id) {
        return false;
      }
      const possibleTime = filterMessage.cleanContent.toLowerCase();
      const matches = validDateFormats.some((format) => moment.tz(possibleTime, format, userTz).isValid());
      if (!matches) {
        void filterMessage.channel.send('Date & Time Does Not Appear to be valid, please try again');
      }
      return matches;
    };

    if (this.sb.isTextChannel(message.channel)) {
      const messageCollector = new MessageCollector(message.channel, { filter, max: 1 });
      messageCollector.on('end', (collected: Collection<string, Message>) => {
        const doAsyncWork = async () => {
          const collectedMessage = collected.first();
          if (collectedMessage) {
            const timeString = collectedMessage.cleanContent.toLowerCase();
            const matchingFormat = validDateFormats.filter((format) => moment.tz(timeString, format, userTz).isValid());

            const eventRepo = this.sb.dbConnection.getRepository(Event);
            const event = new Event();
            event.eventName = eventName.toLowerCase().trim();
            event.eventTime = moment.tz(timeString, matchingFormat, userTz).utc().toDate();
            event.guildId = guildId;
            event.user = await userRepo.findOneOrFail({ where: { discordUserId: message.author.id } });
            const savedEvent = await eventRepo.save(event, { reload: true });

            const eventMoment = moment.tz(savedEvent.eventTime, 'UTC');
            await message.channel.send(
              `I have an event: "${savedEvent.eventName}" happening on ${eventMoment
                .tz(userTz)
                .format('D, MMM [at] LT z')}`,
            );
          }
        };
        void doAsyncWork();
      });
    }
  }
}
