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

    const character = await this.sb.dbConnection
      .getRepository(FFXIVChar)
      .findOne({ where: { user: message.member.id } });
    let memberByUserId = await this.sb.dbConnection.getRepository(COTMember).findOne({ where: { character } });

    const name = params.args.trim().toLowerCase();
    if (memberByUserId && name === memberByUserId.character.name.trim().toLowerCase()) {
      await message.channel.send(`You've already claimed the character: ${memberByUserId.character.name}.`);
      return;
    }
    if (!name) {
      await message.channel.send(this.getHelpText());
      return;
    }
    if (name === 'sasner rensas' || name === 'sasner') {
      await message.channel.send('"Sasner Rensas" is the example, you need put in YOUR characters name.');
      return;
    }

    const charByName = await this.sb.dbConnection
      .getRepository(FFXIVChar)
      .createQueryBuilder()
      .where(`LOWER(name) = LOWER(:name)`, { name })
      .getOne();

    if (charByName?.user.discordUserId && charByName.user.discordUserId !== message.member.id) {
      const sasner = await this.sb.getSasner();
      await message.channel.send(
        `${charByName.name} has already been claimed by another user. Please contact ${sasner} for help.`,
      );
      return;
    }

    memberByUserId = await COTMember.getCotMemberByName(name, message.member.id);
    let rankRole: CotRanks = memberByUserId.rank === CotRanks.NEW ? CotRanks.RECRUIT : memberByUserId.rank;
    if (!message.member.roles.cache.has(rankRole)) {
      if (memberByUserId.rank === CotRanks.OFFICER) {
        rankRole = CotRanks.VETERAN;
      }
      try {
        if (message.member.roles.cache.has(CotRanks.GUEST)) {
          await message.member.roles.remove(CotRanks.GUEST, 'claimed member');
        }
        await message.member.roles.add(rankRole, 'user claimed member');
        await message.channel.send(`Thank you, I now have you as: ${memberByUserId.character.name}`);
        if (memberByUserId.rank === CotRanks.OFFICER) {
          await message.channel.send(
            "I cannot add the Officer Rank, please have an Officer update you. I've temporarily set you to Veteran",
          );
        }
      } catch (error) {
        const sasner = this.sb.getSasner();
        await message.channel.send(`I'm a terrible bot, I could not add your rank: ${sasner} please come help me.`);
        this.sb.logger.warn('unable to add role (2)', { error, member: message.member, rankRole });
      }
    }
  }
}
