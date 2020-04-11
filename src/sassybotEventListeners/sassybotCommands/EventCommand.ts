import { Collection, Message, MessageCollector } from 'discord.js';
import moment = require('moment-timezone');
import { MoreThanOrEqual } from 'typeorm';
import Event from '../../entity/Event';
import SbUser from '../../entity/SbUser';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class EventCommand extends SassybotCommand {
  public readonly command = 'event';

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} event [create] {event_name}`';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const userRepository = this.sb.dbConnection.getRepository(SbUser);
    let currentUser = await userRepository.findOne(message.author.id);
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

    if (params.args.trim().toLowerCase() === 'list' || params.args.trim().toLowerCase() === 'all') {
      await this.listAll(message, currentUser.timezone);
      return;
    }

    const compressedArgs = params.args.replace(/\s\s+/g, ' ').trim();
    const matches = compressedArgs.match(/^(create)?\s?(.*)/);
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

    const eventRepository = this.sb.dbConnection.getRepository(Event);
    try {
      const event = await eventRepository.findOneOrFail({
        where: { eventName, eventTime: MoreThanOrEqual<Date>(new Date()) },
      });
      const eventMoment = moment.tz(event.eventTime, 'UTC');
      const formattedDate = eventMoment.tz(currentUser.timezone).format('D, MMM [at] LT z');
      await message.channel.send(`"${eventName}" is happening on ${formattedDate}`);
    } catch (e) {
      await message.channel.send('Sorry, I was unable to find an event by that name');
      return;
    }
  }

  private async createEvent(message: Message, eventName: string, userTz: string) {
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
        filterMessage.channel.send('Date & Time Does Not Appear to be valid, please try again');
      }
      return matches;
    };

    const messageCollector = new MessageCollector(message.channel, filter, { max: 1 });
    messageCollector.on('end', async (collected: Collection<string, Message>) => {
      const collectedMessage = collected.first();
      if (collectedMessage) {
        const timeString = collectedMessage.cleanContent.toLowerCase();
        const matchingFormat = validDateFormats.filter((format) => moment.tz(timeString, format, userTz).isValid());

        const eventRepo = this.sb.dbConnection.getRepository(Event);
        const event = new Event();
        event.eventName = eventName.toLowerCase().trim();
        event.eventTime = moment
          .tz(timeString, matchingFormat, userTz)
          .utc()
          .toDate();
        const savedEvent = await eventRepo.save(event, { reload: true });

        const eventMoment = moment.tz(savedEvent.eventTime, 'UTC');
        await message.channel.send(
          `I have an event: "${savedEvent.eventName}" happening on ${eventMoment
            .tz(userTz)
            .format('D, MMM [at] LT z')}`,
        );
      }
    });
  }

  private async listAll(message: Message, userTz: string): Promise<void> {
    const eventRepo = this.sb.dbConnection.getRepository(Event);
    const allEvents = await eventRepo.find({ where: { eventTime: MoreThanOrEqual<Date>(new Date()) } });
    if (allEvents && allEvents.length) {
      await Promise.all(
        allEvents.map(async (event: Event) => {
          const eventMoment = moment.tz(event.eventTime, 'UTC');
          await message.channel.send(
            `"${event.eventName}" happening on ${eventMoment.tz(userTz).format('D, MMM [at] LT z')}`,
          );
        }),
      );
      return;
    }
    await message.channel.send('No Future Events Scheduled');
  }
}
