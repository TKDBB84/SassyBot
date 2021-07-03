import { Message, MessageCollector } from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import { MoreThan } from 'typeorm';
import AbsentRequest from '../../../entity/AbsentRequest';
import ActivityCommand from './ActivityCommand';
import { CotRanks } from '../../../consts';
import { ISassybotCommandParams } from '../../../Sassybot';

export default class AbsentCommand extends ActivityCommand {
  protected getHelpText(): string {
    return `Usage: \`!sb absent [## days|weeks|months] -- you can specify a number of days, weeks or months to be gone, or I will prompt you for start and end dates.`;
  }
  public readonly commands = ['absent', 'absence'];

  private static runningUsers = new Set();

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

  protected async activityListener({
    message,
    params,
  }: {
    message: Message;
    params: ISassybotCommandParams;
  }): Promise<void> {
    const messageAuthorId = message.author.id;
    if (!this.sb.isTextChannel(message.channel)) {
      return;
    }
    if (AbsentCommand.runningUsers.has(messageAuthorId)) {
      return;
    }
    const filter = (filterMessage: Message) => filterMessage.author.id === messageAuthorId;
    let foundMember = await this.sb.findCoTMemberByDiscordId(messageAuthorId);
    const absent = new AbsentRequest();
    absent.requested = new Date();

    const diffDateFormat = /(\d+)\s+(\bdays?\b|\bweeks?\b|\bmonths?\b)/i;
    type timeUnit = 'day' | 'days' | 'week' | 'weeks' | 'month' | 'months';
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const dateComponents: [string, string, timeUnit] | null = diffDateFormat.exec(params.args.trim());
    if (dateComponents && dateComponents.length === 3) {
      const amount = parseInt(dateComponents[1], 10);
      const unit = dateComponents[2];
      if (amount <= 0) {
        await message.reply('Cannot request absenteeism for 0 or negative days');
        return;
      }
      if (!foundMember) {
        await this.requestCharacterName(message);
        try {
          const collectedMessage = await message.channel.awaitMessages(filter, {
            max: 1,
            time: 30000,
            errors: ['time'],
          });
          const declaredName = collectedMessage.first();
          if (declaredName) {
            foundMember = await this.parseCharacterName(declaredName);
          } else {
            return;
          }
        } catch (e) {
          // do nothing
          return;
        }
      }
      absent.CotMember = foundMember;
      absent.startDate = moment().toDate();
      absent.endDate = moment().add(amount, unit).toDate();
      if (await AbsentCommand.checkDuration(message, absent)) {
        await this.summarizeData(message, absent);
      }
      return;
    }

    AbsentCommand.runningUsers.add(messageAuthorId);
    const expiration = setTimeout(() => {
      AbsentCommand.runningUsers.delete(messageAuthorId);
    }, 300000); // 5 min
    let messageCount = 0;
    if (!foundMember) {
      await this.requestCharacterName(message);
    } else {
      absent.CotMember = foundMember;
      await this.requestStartDate(message, absent);
      messageCount = 1;
    }
    const messageCollector = new MessageCollector(message.channel, filter, { time: 300000 });
    messageCollector
      .on('collect', (collectedMessage: Message) => {
        const asyncWork = async () => {
          const messageText = collectedMessage.cleanContent.toLowerCase();
          if (['no', 'stop', 'reset', 'clear', 'cancel'].includes(messageText)) {
            AbsentCommand.runningUsers.delete(messageAuthorId);
            clearTimeout(expiration);
            messageCount = 0;
            messageCollector.stop();
            await collectedMessage.reply("I've canceled everything, you can just start over now");
            return;
          }
          switch (messageCount) {
            case 0: {
              foundMember = await this.parseCharacterName(collectedMessage);
              absent.CotMember = foundMember;
              await this.requestStartDate(collectedMessage, absent);
              break;
            }
            case 1: {
              const startDate = await this.parseDate(collectedMessage);
              if (!startDate) {
                await this.requestStartDate(collectedMessage, absent);
                messageCount--;
              } else {
                absent.startDate = startDate;
                await this.requestEndDate(collectedMessage, absent);
              }
              break;
            }
            case 2: {
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
                AbsentCommand.runningUsers.delete(messageAuthorId);
                clearTimeout(expiration);
                messageCollector.stop();
              }
              break;
            }
          }
          messageCount++;
        };
        void asyncWork();
      })
      .on('end', () => {
        AbsentCommand.runningUsers.delete(messageAuthorId);
        clearTimeout(expiration);
      });
  }

  protected async requestStartDate(message: Message, absentRequest: AbsentRequest): Promise<Message> {
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

  protected async requestEndDate(message: Message, absentRequest: AbsentRequest): Promise<Message> {
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
        maxDuration = 30;
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
