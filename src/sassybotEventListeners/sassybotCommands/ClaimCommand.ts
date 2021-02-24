import { Message } from 'discord.js';
import { CotRanks, GuildIds } from '../../consts';
import COTMember from '../../entity/COTMember';
import FFXIVChar from '../../entity/FFXIVChar';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import SbUser from '../../entity/SbUser';

export default class ClaimCommand extends SassybotCommand {
  public readonly commands = ['claim'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} claim YOUR CHARNAME` ---- ex: `!sb claim Sasner Rensas` binds your discord account to Sassybots character database';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (!message.guild || !message.member) {
      return;
    }
    const name = params.args.trim().toLowerCase();
    if (!name) {
      await message.channel.send(this.getHelpText());
      return;
    }

    const sbUser = await SbUser.findOrCreateUser(message.author.id);
    const charRepository = this.sb.dbConnection.getRepository(FFXIVChar);
    let character = await charRepository.findOne({ where: { user: sbUser.discordUserId } });
    if (character) {
      await message.channel.send(
        `I already have you as: ${character.name}, if this isn't correct, please contact Sasner`,
      );
      return;
    } else {
      character = await FFXIVChar.findOrCreateCharacter(name, sbUser);
    }
    const CoTMemberRepo = this.sb.dbConnection.getRepository(COTMember);
    const cotMember = await CoTMemberRepo.findOne({ where: { character: character.id } });

    if (cotMember) {
      let rankRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, cotMember.rank);
      if (!rankRole) {
        this.sb.logger.warn('unable to fetch rank', { rank: cotMember.rank });
        await message.channel.send(
          'However, I was unable to set your discord rank, one of the officers can help if needed.',
        );
        return;
      }
      if (message.member.roles.cache.has(CotRanks.GUEST)) {
        await message.member.roles.remove(CotRanks.GUEST, 'claimed member');
      }
      if (!message.member.roles.cache.has(rankRole.id)) {
        const memberRank = cotMember.rank;
        // noinspection FallThroughInSwitchStatementJS
        switch (memberRank) {
          case CotRanks.OFFICER:
            await message.channel.send(
              "I cannot add the Officer Rank, please have an Officer update you. I've temporarily set you to Veteran",
            );
            rankRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.VETERAN);
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
    await message.channel.send(`Thank you, I now have you as: ${character.name}`);
  }
}
