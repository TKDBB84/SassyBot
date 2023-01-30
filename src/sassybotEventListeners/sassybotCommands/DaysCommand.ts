import { Message } from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { CotRanks, GuildIds, UserIds } from '../../consts';
import FFXIVChar from '../../entity/FFXIVChar';
import { getNumberOFDays, isMessageFromAdmin } from './lib';

export default class DaysCommand extends SassybotCommand {
  public readonly commands = ['days', 'day'];

  public getHelpText(): string {
    return "usage: `!{sassybot|sb} days` -- I tell you the number of days  you've been in the fc, as best i know";
  }

  private static stupidFakeReset: { [key: string]: Date } = {};

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (!message.guild || !message.member) {
      return;
    }

    const officerRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    const isOfficerQuery = isMessageFromAdmin(message, officerRole) && !!params.args.trim();

    const authorId = message.author.id;
    const cotMember = await this.sb.findCoTMemberByDiscordId(authorId);
    let firstSeen: moment.Moment | false;
    let charName: string;

    if (!isOfficerQuery) {
      if (cotMember) {
        firstSeen = cotMember.character.firstSeenApi ? moment(cotMember.character.firstSeenApi) : false;
        if (firstSeen && firstSeen.isBefore('1900-01-01 00:00:00')) {
          firstSeen = false;
        }
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
        if (firstSeen && firstSeen.isBefore('1900-01-01 00:00:00')) {
          firstSeen = false;
        }
        charName = charByDiscordId.name;
      }
    } else {
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
      if (firstSeen && firstSeen.isBefore('1900-01-01 00:00:00')) {
        firstSeen = false;
      }
      charName = charByName.name;
    }

    if (message.author.id === UserIds.SASNER && params.args.trim() === '') {
      await message.reply({ content: `STFU you don't even play this game anymore.` });
      return;
    }

    if (!firstSeen) {
      await message.channel.send(`${charName} does not appear to be in the FC.`);
      return;
    }

    let daysInFc = `${charName} has been `;
    if (charName.toLowerCase() === 'illistil calen') {
      await message.channel.send('Illistil Calen has been in the FC longer than whoever is asking');
      return;
    } else if (charName.toLowerCase() === 'brigie ishigami') {
      await message.channel.send(
        "Brigie Ishigami has been in the FC for ..... Fuck man, I don't know at least 10,000 chicken nuggets, or something",
      );
      return;
    } else if (charName.toLowerCase() === 'belladas lionheart') {
      await message.channel.send(
        "Bella's days are numbered.... we just have no idea what that number is.",
      );
      return;
    }

    if (!isOfficerQuery && DaysCommand.stupidFakeReset[charName.toLowerCase()]) {
      const fakeDays = getNumberOFDays(DaysCommand.stupidFakeReset[charName.toLowerCase()]);
      await message.channel.send(
        `You didn't think I was going to do it did you? ${charName} you've been in the FC for ${fakeDays} days, you lose.`,
      );
      return;
    }

    const randNum = Math.random();
    const numDays = getNumberOFDays(firstSeen);
    if (!isOfficerQuery && numDays > 1000 && randNum <= 0.4) {
      daysInFc =
        "More than 1,000 days, are you happy? Why are you even still checking?  This isn't some contest. You know what, I'm resetting your days to 0, suck it bitch.";
      DaysCommand.stupidFakeReset[charName.toLowerCase()] = new Date();
    } else {
      if (charName.toLowerCase().includes('minfilia')) {
        daysInFc += 'locked in the Waking Sands ';
      } else {
        daysInFc += 'in the FC ';
      }
      daysInFc += `for approximately ${numDays} days.`;
    }

    await this.sb.sendEventMessage('daysRequest', {
      isOfficerQuery,
      numDays,
      charName,
      authorId,
      channelId: message.channelId,
      messageId: message.id,
    });
    await message.channel.send(daysInFc);
  }
}
