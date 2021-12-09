import { Message } from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { CotRanks, GuildIds } from '../../consts';
import FFXIVChar from '../../entity/FFXIVChar';
import { getNumberOFDays, isMessageFromAdmin } from './lib';

export default class DaysCommand extends SassybotCommand {
  public readonly commands = ['days', 'day'];

  public getHelpText(): string {
    return "usage: `!{sassybot|sb} days` -- I tell you the number of days  you've been in the fc, as best i know";
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (!message.guild || !message.member) {
      return;
    }

    const authorId = message.author.id;
    const cotMember = await this.sb.findCoTMemberByDiscordId(authorId);
    let firstSeen: moment.Moment | false;
    let charName: string;
    if (cotMember) {
      firstSeen = cotMember.character.firstSeenApi ? moment(cotMember.character.firstSeenApi) : false;
      charName = cotMember.character.name;
    } else {
      // try finding by discord id
      const charByDiscordId = await this.sb.dbConnection
        .getRepository(FFXIVChar)
        .createQueryBuilder()
        .where(`userDiscordUserId = :userId`, { userId: message.author.id })
        .getOne();

      if (!charByDiscordId) {
        await message.channel.send(
          `I'm  not sure who you are, you can use \`!sb claim Your CharName\` (ex: \`!sb claim Sasner Rensas\`) to claim your character`,
        );
        return;
      }
      firstSeen = charByDiscordId.firstSeenApi ? moment(charByDiscordId.firstSeenApi) : false;
      charName = charByDiscordId.name;
    }

    const officerRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    const isOfficerQuery = isMessageFromAdmin(message, officerRole) && !!params.args.trim();
    if (isOfficerQuery) {
      const targetMember = params.args.trim().toLowerCase();
      const charByName = await this.sb.dbConnection
        .getRepository(FFXIVChar)
        .createQueryBuilder()
        .where(`LOWER(name) = LOWER(:name)`, { name: targetMember })
        .getOne();

      if (!charByName) {
        await message.channel.send(`I have never seen a character by the name: ${targetMember}`);
        return;
      }
      firstSeen = charByName.firstSeenApi ? moment(charByName.firstSeenApi) : false;
      charName = charByName.name;
    }

    if (!firstSeen) {
      await message.channel.send(`${charName} does not appear to be in the FC.`);
      return;
    }

    let daysInFc = `${charName} has been `;
    if (charName.includes('Minfilia')) {
      daysInFc += 'locked in the Waking Sands ';
    } else {
      daysInFc += 'in the FC ';
    }
    daysInFc += `for approximately ${getNumberOFDays(firstSeen)} days.`;

    // const randNum = Math.random();
    // if (randNum <= 0.01 && !isOfficerQuery) {
    // await message.channel.send(
    // `${charName} been in the FC for ${DaysCommand.randomIntFromInterval(1000, 9000)} days`,
    // );
    // await DaysCommand.sleep(10);
    // await message.channel.send('No... Wait, I did the math wrong');
    // await DaysCommand.sleep(15);
    // await message.channel.send(`It's definitely ${DaysCommand.randomIntFromInterval(1, 20)} days`);
    // await DaysCommand.sleep(10);
    // await message.channel.send(
    // "NO NO NO NO NO that can't be right either... I can do this... I am a bot, I can do basic Math...",
    // );
    // await DaysCommand.sleep(5);
    // await message.channel.send('carry the 3... the sum of the negative hypotenuse...');
    // await DaysCommand.sleep(10);
    // daysInFc += '.. final answer!';
    // }
    await message.channel.send(daysInFc);
  }

  private static randomIntFromInterval(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  private static sleep(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, seconds * 1000);
    });
  }
}
