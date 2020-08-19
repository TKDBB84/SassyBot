import {Message, MessageCollector} from 'discord.js';
import * as moment from 'moment';
import 'moment-timezone';
import {MoreThan} from 'typeorm';
import AbsentRequest from '../../../entity/AbsentRequest';
import ActivityCommand from './ActivityCommand';
import {CotRanks} from '../../../consts';

export default class AbsentCommand extends ActivityCommand {
  public readonly commands = ['absent', 'absence'];

  protected async listAll(message: Message): Promise<void> {
    const yesterday = new Date();
    yesterday.setTime(new Date().getTime() - 36 * (60 * 60 * 1000));
    const allAbsences = await this.sb.dbConnection.getRepository(AbsentRequest).find({
      where: { endDate: MoreThan<Date>(yesterday) },
    });
    if (allAbsences.length === 0) {
      await message.channel.send('No Current Absentees');
      return;
    }

    const sortedAbsences = allAbsences.sort((a, b) =>
      a.CotMember.character.name.localeCompare(b.CotMember.character.name, 'en'),
    );

    let reply = '__Current Absentee List:__\n';
    sortedAbsences.forEach((absence) => {
      reply += `${absence.CotMember.character.name}\tFrom: ${absence.startDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
        year: 'numeric',
      })}\tTo: ${absence.endDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
        year: 'numeric',
      })}\n`;
    });
    await message.channel.send(reply, { split: true });
    return;
  }

  protected async activityListener({ message }: { message: Message }): Promise<void> {
    const absent = new AbsentRequest();
    absent.requested = new Date();
    let foundMember = await this.sb.findCoTMemberByDiscordId(message.author.id);
    let messageCount = 0;
    if (!foundMember) {
      await this.requestCharacterName(message);
    } else {
      absent.CotMember = foundMember;
      await this.requestStartDate(message, absent);
      messageCount = 1;
    }
    const filter = (filterMessage: Message) => filterMessage.author.id === message.author.id;
    if (this.sb.isTextChannel(message.channel)) {
      const messageCollector = new MessageCollector(message.channel, filter);
      messageCollector.on('collect', async (collectedMessage: Message) => {
        switch (messageCount) {
          case 0:
            foundMember = await this.parseCharacterName(collectedMessage);
            absent.CotMember = foundMember;
            await this.requestStartDate(collectedMessage, absent);
            break;
          case 1:
            const startDate = await this.parseDate(collectedMessage);
            if (!startDate) {
              await this.requestStartDate(collectedMessage, absent);
              messageCount--;
            } else {
              absent.startDate = startDate;
              this.requestEndDate(collectedMessage, absent);
            }
            break;
          case 2:
            const endDate = await this.parseDate(collectedMessage);
            if (!endDate) {
              await this.requestEndDate(collectedMessage, absent);
              messageCount--;
            } else {
              absent.endDate = endDate;
              const durationAllowed = await AbsentCommand.checkDuration(collectedMessage, absent);
              if (durationAllowed) {
                await this.summarizeData(collectedMessage, absent);
              }
              messageCollector.stop();
            }
            break;
        }
        messageCount++;
      });
    }
  }

  protected async requestStartDate(message: Message, absentRequest: AbsentRequest) {
    return await message.reply(
      `Ok, ${absentRequest.CotMember.character.name}, What is the first day you'll be gone?  (because i'm a dumb bot please use YYYY-MM-DD format)`,
    );
  }

  protected async parseDate(message: Message): Promise<Date | false> {
    const possibleDate = message.cleanContent;
    if (moment(possibleDate, 'YYYY-MM-DD').isValid()) {
      return moment(possibleDate, 'YYYY-MM-DD').toDate();
    }
    await message.reply('Date Does Not Appear to be valid YYYY-MM-DD, please try again with that date format', {
      reply: message.author,
    });
    return false;
  }

  protected async requestEndDate(message: Message, absentRequest: AbsentRequest) {
    return await message.reply(
      `Ok, ${absentRequest.CotMember.character.name}, When do you think you'll be back? If you're not sure, just add a few days to the end.  (because i'm a dumb bot please use YYYY-MM-DD format)`,
    );
  }

  protected async summarizeData(message: Message, absentRequest: AbsentRequest): Promise<void> {
    const savedAbsences = await this.sb.dbConnection.getRepository(AbsentRequest).save(absentRequest, { reload: true });
    const summary = `__Here's the data I have Stored:__ \n\n Character: ${
      savedAbsences.CotMember.character.name
    } \n First Day Gone: ${savedAbsences.startDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      year: 'numeric',
    })} \n Returning: ${savedAbsences.endDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      year: 'numeric',
    })}`;
    await message.reply(summary, { reply: message.author, split: true });
  }

  private static async checkDuration(message: Message, absentRequest: AbsentRequest): Promise<boolean> {
    let maxDuration;
    switch (absentRequest.CotMember.rank) {
      case CotRanks.MEMBER:
        maxDuration = 90;
        break;
      case CotRanks.GUEST:
      case CotRanks.NEW:
      case CotRanks.RECRUIT:
        maxDuration = 14;
        break;
      default:
        maxDuration = 180;
    }
    const duration = moment(absentRequest.endDate).diff(absentRequest.startDate, 'days');
    if (duration > maxDuration) {
      await message.reply(
        `This request Appears to be for *${duration} days*, the max your rank allows is *${maxDuration} days*.\n\nThis Request has been canceled.`,
      );
      return false;
    }
    return true;
  }
}
