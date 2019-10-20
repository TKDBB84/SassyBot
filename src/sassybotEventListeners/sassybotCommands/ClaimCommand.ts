import { Message } from 'discord.js';
import { CotRanks, GuildIds } from '../../consts';
import COTMember from '../../entity/COTMember';
import FFXIVChar from '../../entity/FFXIVChar';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class ClaimCommand extends SassybotCommand {
  public readonly command = 'claim';

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} claim ${YOUR+CHAR+NAME}` ---- ex: `!sb claim Sasner Rensas`';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const CoTMemberRepo = this.sb.dbConnection.getRepository(COTMember);
    let memberByUserId = await CoTMemberRepo.createQueryBuilder()
      .where({ discordUserId: message.member.id })
      .getOne();
    if (memberByUserId) {
      await message.channel.send(
        `I already have you as: ${memberByUserId.character.name}, if this isn't correct, please contact Sasner`,
      );
      return;
    }
    const lastSeenData = await this.sb.dbConnection
      .getRepository(FFXIVChar)
      .createQueryBuilder()
      .select('MAX(`lastSeenApi`) as lastPull')
      .getRawOne();

    const mostRecentPull = lastSeenData.lastPull;
    const name = params.args.trim().toLowerCase();
    memberByUserId = await CoTMemberRepo.createQueryBuilder()
      .where('LOWER(name) = :name', { name })
      .getOne();
    if (!memberByUserId) {
      await message.channel.send(
        `I'm sorry ${name}, I don't see you as a current FC member, when I last checked at: ${mostRecentPull}. Sasner can add you to the database if needed.`,
      );
      return;
    }

    memberByUserId.character.user.discordUserId = message.member.id;
    await CoTMemberRepo.save(memberByUserId);
    await message.channel.send(`Thank you, I now have you as: ${memberByUserId.character.name}`);
    let rank = await this.sb.getRole(GuildIds.COT_GUILD_ID, memberByUserId.rank);
    if (!rank) {
      console.error('unable to fetch rank');
      await message.channel.send('However, I was unable to set your discord rank, one of the officers can help.');
      return;
    }
    switch (memberByUserId.rank) {
      case CotRanks.OFFICER:
        await message.channel.send(
          "I cannot add the Officer Rank, please have Tyr update you. I've temporarily set you to Veteran",
        );
        rank = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.VETERAN);
      case CotRanks.VETERAN:
        if (rank) {
          await message.member.addRole(rank).catch(console.error);
        }
        break;
      case CotRanks.MEMBER:
      case CotRanks.RECRUIT:
      default:
        await message.member.addRole(rank).catch(console.error);
        break;
    }
  }
}
