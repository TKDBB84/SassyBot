import { GuildMember, Message } from 'discord.js';
import { CotRanks, CoTRankValueToString, GuildIds } from '../../consts';
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
    if (!message.guild || !message.member || message.guild.id !== GuildIds.COT_GUILD_ID) {
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
      await message.channel.send(`Thank you, I now have you as: ${character.name}`);
    }
    const CoTMemberRepo = this.sb.dbConnection.getRepository(COTMember);
    const cotMember = await CoTMemberRepo.findOne({ where: { character: character.id } });
    if (!cotMember) {
      await message.member.roles.add(CotRanks.GUEST, 'claimed non-COT character');
      return;
    }

    await message.member.roles.remove(CotRanks.GUEST, 'claimed COT member');
    await message.channel.send(
      `I've found your COT Membership, setting you rank to ${CoTRankValueToString[cotMember.rank]}`,
    );

    if (cotMember.rank === CotRanks.OFFICER) {
      await message.channel.send(
        "I cannot add the Officer Rank, please have an Officer update you. I've temporarily set you to Veteran",
      );
      await this.addRole(message.member, CotRanks.VETERAN);
      return;
    }

    if (cotMember.rank === CotRanks.OTHER) {
      cotMember.rank = CotRanks.GUEST;
    }
    await this.addRole(message.member, cotMember.rank);
  }

  private async addRole(member: GuildMember, rank: CotRanks): Promise<void> {
    try {
      await member.roles.add(rank, 'user claimed member');
    } catch (error) {
      this.sb.logger.warn('unable to add role', [{ member, rankRole: rank }, error]);
    }
  }
}
