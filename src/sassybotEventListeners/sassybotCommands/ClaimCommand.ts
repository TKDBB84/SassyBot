import { Message } from 'discord.js';
import { CotRanks, GuildIds } from '../../consts';
import COTMember from '../../entity/COTMember';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class ClaimCommand extends SassybotCommand {
  public readonly command = 'claim';

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} claim ${YOUR+CHAR+NAME}` ---- ex: `!sb claim Sasner Rensas`';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const CoTMemberRepo = this.sb.dbConnection.getRepository(COTMember);
    let memberByUserId = await CoTMemberRepo.findOne({
      relations: ['character', 'character.user'],
      where: { player: { user: { discordUserId: message.member.id } } },
    });
    if (memberByUserId) {
      await message.channel.send(
        `I already have you as: ${memberByUserId.character.name}, if this isn't correct, please contact Sasner`,
      );
      return;
    }

    const name = params.args.trim().toLowerCase();
    memberByUserId = await COTMember.getCotMemberByName(name, message.member.id);
    if (memberByUserId.rank === CotRanks.NEW) {
      // falling back to recruit
      memberByUserId.rank = CotRanks.RECRUIT;
    }
    await message.channel.send(`Thank you, I now have you as: ${memberByUserId.character.name}`);
    let rankRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, memberByUserId.rank);
    if (!rankRole) {
      console.error('unable to fetch rank');
      await message.channel.send(
        'However, I was unable to check your discord rank, one of the officers can help if needed.',
      );
      return;
    }
    if (!message.member.roles.has(rankRole.id)) {
      switch (memberByUserId.rank) {
        case CotRanks.OFFICER:
          await message.channel.send(
            "I cannot add the Officer Rank, please have an Officer update you. I've temporarily set you to Veteran",
          );
          rankRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.VETERAN);
        case CotRanks.VETERAN:
          if (rankRole) {
            await message.member.addRole(rankRole).catch(console.error);
          }
          break;
        case CotRanks.MEMBER:
        case CotRanks.RECRUIT:
        default:
          await message.member.addRole(rankRole).catch(console.error);
          break;
      }
    }
  }
}
