import { Message } from 'discord.js';
import * as moment from 'moment';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class DaysCommand extends SassybotCommand {
  public readonly command = 'days';

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} echo {message}` -- I tell you the number of days  you\'ve been in the fc, as best i know';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const authorId = message.author.id;
    const cotMember = await this.sb.findCoTMemberByDiscordId(authorId);
    if (!cotMember) {
      await message.channel.send(
        `'I'm  not sure who you are, you can use \`!sb claim [your_char_name]\` to claim your character`,
      );
      return;
    }

    const firstPull = moment(new Date(2019, 10, 11, 23, 59, 59));
    const beginningOfTime = moment(new Date(2019, 9, 2, 23, 59, 59));
    const firstSeen = moment(cotMember.character.firstSeenApi);
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
