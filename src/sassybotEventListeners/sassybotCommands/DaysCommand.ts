import { Message } from 'discord.js';
import * as moment from 'moment';
import 'moment-timezone';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { CotRanks, GuildIds, UserIds } from '../../consts';
import FFXIVChar from '../../entity/FFXIVChar';
import getNumberOFDays from './lib/GetNumberOfDays';

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
    if (!cotMember) {
      await message.channel.send(
        `I'm  not sure who you are, you can use \`!sb claim Your CharName\` (ex: \`!sb claim Sasner Rensas\`) to claim your character`,
      );
      return;
    }
    let firstSeen = cotMember.character.firstSeenApi ? moment(cotMember.character.firstSeenApi) : false;
    let charName = cotMember.character.name;

    const OfficerRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    if (
      ((OfficerRole && message.member.roles.highest.comparePositionTo(OfficerRole) >= 0) ||
        message.author.id === UserIds.SASNER) &&
      !!params.args.trim()
    ) {
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

    const daysNum = getNumberOFDays(firstSeen);
    let daysInFc = `${charName} has been in the FC for approximately ${daysNum} days`;
    if (charName.includes('Minfilia')) {
      daysInFc = `${charName} has been locked in the Waking Sands for approximately ${daysNum} days`;
    }

    if (daysNum >= 500) {
      daysInFc = `${charName} has been in the FC for too damn long.`;
      if (charName.includes('Minfilia')) {
        daysInFc = `${charName} has been locked in the Waking Sands for too damn long`;
      }
    }
    await message.channel.send(daysInFc);
  }
}
