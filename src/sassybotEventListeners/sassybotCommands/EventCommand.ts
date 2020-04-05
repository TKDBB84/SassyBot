import { Collection, Message, MessageCollector } from 'discord.js';
import moment = require('moment-timezone');
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
      currentUser = await userRepository.save(currentUser);
    }
    if (!currentUser.timezone || currentUser.timezone.trim() === 'UTC') {
      await message.channel.send(
        'Sorry, you dont have a timezone registered for yourself, use `!sb tz` to set a timezone',
      );
      return;
    }

    const isCreating = params?.args?.[0].trim().toLowerCase() === 'create';
    const eventName = isCreating ? params?.args?.[1].trim().toLowerCase() : params?.args?.[0].trim().toLowerCase();
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
      const event = await eventRepository.findOneOrFail({ where: { eventName } });
      const eventMoment = moment(event.eventTime).tz(currentUser.timezone);
      const formattedDate = eventMoment.format('D, MMM [at] LT');
      await message.channel.send(`${eventName} is happening on ${formattedDate}`);
    } catch (e) {
      await message.channel.send('Sorry, I was unable to find an event by that name');
      return;
    }
  }

  private async createEvent(message: Message, eventName: string, userTz: string) {
    const event = new Event();
    const eventRepo = this.sb.dbConnection.getRepository(Event);
    event.eventName = eventName.toLowerCase().trim();
    await message.channel.send(
      "What day will the event happen on? please use YYYY-MM-DD format because I'm a dumb bot",
    );
    const eventDate = await this.getEventDate(message, userTz);
    await message.channel.send(
      'What time (local to you) will the event happen? i can accept things like 3:27pm, 15:27, 03:27pm',
    );
    event.eventTime = await this.getEventTime(message, eventDate, userTz);

    const savedEvent = await eventRepo.save(event);
    const eventMoment = moment(savedEvent.eventTime).tz(userTz);
    await message.channel.send(
      `I have an event name ${savedEvent.eventName} happening on ${eventMoment.format('D, MMM [at] LT')}`,
    );
  }

  private async getEventDate(message: Message, userTz: string): Promise<Date> {
    return new Promise((resolve, reject) => {
      const filter = (filterMessage: Message) => {
        if (filterMessage.author.id !== message.author.id) {
          return false;
        }

        const possibleDate = message.cleanContent.toLowerCase().trim();
        return moment(possibleDate, 'YYYY-MM-DD', userTz).isValid();
      };
      const messageCollector = new MessageCollector(message.channel, filter, { max: 1 });
      messageCollector.on('dispose', async (discardedMessage: Message) => {
        if (discardedMessage.author.id === discardedMessage.author.id) {
          await discardedMessage.channel.send(
            'Date Does Not Appear to be valid YYYY-MM-DD, please try again with that date format: YYYY-MM-DD',
          );
        }
      });
      messageCollector.on('end', (collected: Collection<string, Message>) => {
        const collectedMessage = collected.first();
        if (collectedMessage) {
          resolve(moment(collectedMessage.cleanContent.trim().toLowerCase(), 'YYYY-MM-DD', userTz).toDate());
        } else {
          reject('no valid date given');
        }
      });
    });
  }

  private async getEventTime(message: Message, eventDate: Date, userTz: string): Promise<Date> {
    return new Promise((resolve, reject) => {
      const validDateFormats = ['YYYY-MM-DD h:mma', 'YYYY-MM-DD hh:mma', 'YYYY-MM-DD hh:mm'];
      const dateString = moment(eventDate).format('YYYY-MM-DD');

      const filter = (filterMessage: Message) => {
        if (filterMessage.author.id !== message.author.id) {
          return false;
        }
        const possibleTime = message.cleanContent.toLowerCase().replace(/\s/g, '');
        return validDateFormats.some((format) => moment(`${dateString} ${possibleTime}`, format, userTz).isValid());
      };
      const messageCollector = new MessageCollector(message.channel, filter, { max: 1 });
      messageCollector.on('dispose', async (discardedMessage: Message) => {
        if (discardedMessage.author.id === discardedMessage.author.id) {
          await discardedMessage.channel.send('Time Does Not Appear to be valid, please try again');
        }
      });
      messageCollector.on('end', (collected: Collection<string, Message>) => {
        const collectedMessage = collected.first();
        if (collectedMessage) {
          const timeString = collectedMessage.cleanContent.toLowerCase().replace(/\s/g, '');
          const fullDateString = `${dateString} ${timeString}`;
          const matchingFormat = validDateFormats.filter((format) => moment(fullDateString, format, userTz).isValid());
          resolve(moment(fullDateString, matchingFormat, userTz).toDate());
        } else {
          reject('no valid date given');
        }
      });
    });
  }
}
