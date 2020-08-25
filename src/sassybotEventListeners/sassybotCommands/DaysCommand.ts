import { Message } from 'discord.js';
import * as moment from 'moment';
import 'moment-timezone';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { CotRanks, UserIds } from '../../consts';
import FFXIVChar from '../../entity/FFXIVChar';

export default class DaysCommand extends SassybotCommand {
  public readonly commands = ['days', 'day'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} echo {message}` -- I tell you the number of days  you\'ve been in the fc, as best i know';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const authorId = message.author.id;
    const cotMember = await this.sb.findCoTMemberByDiscordId(authorId);
    if (!cotMember) {
      await message.channel.send(
        `'I'm  not sure who you are, you can use \`!sb claim Your CharName\` (ex: !sb claim Sasner Rensas) to claim your character`,
      );
      return;
    }
    let firstSeen = moment(cotMember.character.firstSeenApi);

    if (params.args && (cotMember.rank === CotRanks.OFFICER || authorId === UserIds.SASNER)) {
      const targetMember = params.args.trim().toLowerCase();
      const charByName = await this.sb.dbConnection
        .getRepository(FFXIVChar)
        .createQueryBuilder()
        .where(`LOWER(name) = LOWER(:name)`, { name: targetMember })
        .getOne();

      if (!charByName) {
        await message.channel.send(`I haven't seen a character by that name: ${targetMember}`);
        return;
      }
      firstSeen = moment(charByName.firstSeenApi);
    }

    const firstPull = moment(new Date(2019, 10, 11, 23, 59, 59));
    const beginningOfTime = moment(new Date(2019, 9, 2, 23, 59, 59));
    let daysInFc: string = '';
    if (firstSeen.isAfter(firstPull)) {
      daysInFc = `You've been in the FC for approx ${moment().diff(firstSeen, 'd')} days`;
    } else if (firstSeen.isBefore(beginningOfTime)) {
      daysInFc = `Sorry you've been in the FC for longer than Sassybot has been tracking memberships, so more than ${moment().diff(
        beginningOfTime,
        'd',
      )} days`;
    } else if (firstSeen.isAfter(beginningOfTime) && firstSeen.isBefore(firstPull)) {
      daysInFc = `I lost track at one point, but you've been in the FC somewhere between ${moment().diff(
        firstPull,
        'd',
      )} and ${moment().diff(beginningOfTime, 'd')} days`;
    }
    await message.channel.send(daysInFc);
  }
}
