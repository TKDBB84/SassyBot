import { Message } from 'discord.js';
import { CotRanks, GuildIds } from '../../consts';
import COTMember from '../../entity/COTMember';
import FFXIVChar from '../../entity/FFXIVChar';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import SbUser from '../../entity/SbUser';
import { isMessageFromAdmin } from './lib';

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

    if (name === 'sasner rensas' || name === 'sasner') {
      await message.channel.send('"Sasner Rensas" is the example, you need put in YOUR character\'s name.');
      return;
    }

    const userRepo = this.sb.dbConnection.getRepository(SbUser);
    const characterRepo = this.sb.dbConnection.getRepository(FFXIVChar);

    let sbUser = await userRepo.findOne({ where: { discordUserId: message.member.id } });
    if (!sbUser) {
      sbUser = userRepo.create({ discordUserId: message.member.id });
    }
    const previouslyClaimedCharacter = await characterRepo.findOne({
      where: { user: { discordUserId: message.member.id } },
    });
    if (previouslyClaimedCharacter && name === previouslyClaimedCharacter.name.trim().toLowerCase()) {
      await message.channel.send(`You've already claimed the character: ${previouslyClaimedCharacter.name}.`);
      return;
    }

    let charByName = await characterRepo.createQueryBuilder().where(`LOWER(name) = LOWER(:name)`, { name }).getOne();
    if (charByName) {
      const charDiscordId = charByName?.user?.discordUserId;
      if (charDiscordId !== undefined && charDiscordId !== null && charDiscordId !== message.member.id) {
        const sasner = await this.sb.getSasner();
        await message.channel.send(
          `${charByName.name} has already been claimed by another user. Please contact ${sasner.toString()} for help.`,
        );
        return;
      } else if (previouslyClaimedCharacter) {
        await characterRepo.query(
          `UPDATE ffxiv_char SET userDiscordUserId = null WHERE id = ${previouslyClaimedCharacter.id}`,
        );
      }
    } else {
      if (previouslyClaimedCharacter) {
        await characterRepo.query(
          `UPDATE ffxiv_char SET userDiscordUserId = null WHERE id = ${previouslyClaimedCharacter.id}`,
        );
      }
      charByName = characterRepo.create({
        name: name.toLowerCase().trim(),
        apiId: 0,
      });
      charByName.user = sbUser;
      charByName = await characterRepo.save(charByName, { reload: true });
    }

    await characterRepo.update(charByName.id, { user: sbUser });
    await message.channel.send(`Thank you, I now have you as: ${charByName.name}`);
    const cotMember = await this.sb.dbConnection
      .getRepository(COTMember)
      .createQueryBuilder()
      .where('characterId = :id', { id: charByName.id })
      .getOne();

    let rankRole: CotRanks = CotRanks.GUEST;
    if (cotMember) {
      rankRole = cotMember.rank === CotRanks.NEW ? CotRanks.RECRUIT : cotMember.rank;
    }
    const officerRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    if (isMessageFromAdmin(message, officerRole) || rankRole === CotRanks.OFFICER) {
      rankRole = CotRanks.VETERAN;
      await message.channel.send(
        "I cannot add the Officer Rank, please have an Officer update you. I've temporarily set you to Veteran",
      );
    }
    if (!message.member.roles.cache.has(rankRole)) {
      try {
        if (cotMember && message.member.roles.cache.has(CotRanks.GUEST)) {
          await message.member.roles.remove(CotRanks.GUEST, 'claimed member');
        }
        await message.member.roles.add(rankRole, 'user claimed character');
      } catch (error: unknown) {
        const sasner = await this.sb.getSasner();
        await message.channel.send(
          `I'm a terrible bot, I could not add your rank: ${sasner.toString()} please come help me.`,
        );
        this.sb.logger.warn('unable to add role', { error, member: message.member, rankRole });
      }
    }
  }
}
