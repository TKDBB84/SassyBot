import { Message, Snowflake } from 'discord.js';
import { CotRanks, GuildIds } from '../../../consts';
import COTMember from '../../../entity/COTMember';
import FFXIVPlayer from '../../../entity/FFXIVPlayer';
import SbUser from '../../../entity/SbUser';
import { ISassybotCommandParams } from '../../../Sassybot';
import SassybotCommand from '../SassybotCommand';

export default abstract class ActivityCommand extends SassybotCommand {
  public getHelpText(): string {
    return `usage: \`!{sassybot|sb} ${this.command}\` -- something something something`;
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const OfficerRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    if (OfficerRole && message.member.highestRole.comparePositionTo(OfficerRole) >= 0) {
      await this.listAll(message);
    } else {
      await this.activityListener({ message });
    }
  }

  protected async findCoTMemberByDiscordId(discordId: Snowflake): Promise<COTMember | false> {
    const member = await this.sb.dbConnection.getRepository(COTMember).findOne({ where: { discordUserId: discordId } });
    if (member) {
      return member;
    }
    return false;
  }

  protected async requestCharacterName(message: Message) {
    message.channel.send('First, Tell Me Your Full Character Name');
  }

  protected async parseCharacterName(message: Message): Promise<COTMember> {
    const declaredName = message.cleanContent;
    const requestingMember = await this.sb.dbConnection
      .getRepository(COTMember)
      .createQueryBuilder('member')
      .where('LOWER(member.charName) = LOWER(:charName)', { charName: declaredName })
      .getOne();
    if (!requestingMember) {
      const newUser = new SbUser();
      newUser.discordUserId = message.author.id;
      const newPlayer = new FFXIVPlayer();
      newPlayer.charName = message.cleanContent;
      newPlayer.user = await this.sb.dbConnection.getRepository(SbUser).save(newUser);
      const newMember = new COTMember();
      newMember.rank = CotRanks.RECRUIT;
      newMember.charName = message.cleanContent;
      newMember.player = await this.sb.dbConnection.getRepository(FFXIVPlayer).save(newPlayer);
      return await this.sb.dbConnection.getRepository(COTMember).save(newMember);
    }
    return requestingMember;
  }

  protected abstract async activityListener({ message }: { message: Message }): Promise<void>;

  protected abstract async listAll(message: Message): Promise<void>;
}
