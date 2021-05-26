import { Message } from 'discord.js';
import { CotRanks } from '../../consts';
import COTMember from '../../entity/COTMember';
import FFXIVChar from '../../entity/FFXIVChar';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class ClaimCommand extends SassybotCommand {
  public readonly commands = ['claim'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} claim YOUR CHARNAME` ---- ex: `!sb claim Sasner Rensas` binds your discord account to Sassybots character database';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (!message.guild || !message.member) {
      return;
    }
    const charRepository = this.sb.dbConnection.getRepository(FFXIVChar);
    const character = await charRepository.findOne({ where: { user: message.member.id } });
    const CoTMemberRepo = this.sb.dbConnection.getRepository(COTMember);
    let memberByUserId = await CoTMemberRepo.findOne({ where: { character } });
    if (memberByUserId) {
      await message.channel.send(
        `I already have you as: ${memberByUserId.character.name}, if this isn't correct, please contact Sasner`,
      );
      return;
    }

    const name = params.args.trim().toLowerCase();
    if (!name) {
      await message.channel.send(this.getHelpText());
      return;
    }
    memberByUserId = await COTMember.getCotMemberByName(name, message.member.id);
    if (memberByUserId.rank === CotRanks.NEW) {
      // falling back to recruit
      memberByUserId.rank = CotRanks.RECRUIT;
    }
    await message.channel.send(`Thank you, I now have you as: ${memberByUserId.character.name}`);
    let rankRole: CotRanks = memberByUserId.rank;
    if (!rankRole) {
      this.sb.logger.warn('unable to fetch rank', { rank: memberByUserId.rank });
      await message.channel.send(
        'However, I was unable to check your discord rank, one of the officers can help if needed.',
      );
      return;
    }
    if (message.member.roles.cache.has(CotRanks.GUEST)) {
      await message.member.roles.remove(CotRanks.GUEST, 'claimed member');
    }
    if (!message.member.roles.cache.has(rankRole)) {
      const memberRank = memberByUserId.rank;
      // noinspection FallThroughInSwitchStatementJS
      switch (memberRank) {
        case CotRanks.OFFICER:
          await message.channel.send(
            "I cannot add the Officer Rank, please have an Officer update you. I've temporarily set you to Veteran",
          );
          rankRole = CotRanks.VETERAN;
        case CotRanks.VETERAN:
          if (rankRole) {
            await message.member.roles.add(rankRole, 'user claimed Veteran member').catch((error) => {
              this.sb.logger.warn('unable to add role', {
                error,
                member: message.member,
                rankRole: memberRank,
              });
            });
          }
          break;
        case CotRanks.OTHER:
        case CotRanks.MEMBER:
        case CotRanks.RECRUIT:
        default:
          await message.member.roles.add(rankRole, 'user claimed member').catch((error) => {
            this.sb.logger.warn('unable to add role (2)', { error, member: message.member, rankRole: memberRank });
          });
          break;
      }
    }
  }
}
