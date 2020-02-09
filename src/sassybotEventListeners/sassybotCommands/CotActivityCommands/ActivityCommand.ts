import { Message, Snowflake } from 'discord.js';
import { CotRanks, GuildIds, UserIds } from '../../../consts';
import COTMember from '../../../entity/COTMember';
import { ISassybotCommandParams } from '../../../Sassybot';
import SassybotCommand from '../SassybotCommand';

export default abstract class ActivityCommand extends SassybotCommand {
  public getHelpText(): string {
    return `usage: \`!{sassybot|sb} ${this.command}\` -- something something something`;
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const OfficerRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    if (
      (OfficerRole && message.member.highestRole.comparePositionTo(OfficerRole) >= 0)
      // || message.author.id === UserIds.SASNER
    ) {
      await this.listAll(message);
    } else {
      await this.activityListener({ message });
    }
  }

  protected async findCoTMemberByDiscordId(discordId: Snowflake): Promise<COTMember | false> {
    const member = await this.sb.dbConnection.getRepository(COTMember).findOne({ where: { userDiscordUserId: discordId } });
    console.log({discordId, member });
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
    return await COTMember.getCotMemberByName(declaredName, message.author.id);
  }

  protected abstract async activityListener({ message }: { message: Message }): Promise<void>;

  protected abstract async listAll(message: Message): Promise<void>;
}
