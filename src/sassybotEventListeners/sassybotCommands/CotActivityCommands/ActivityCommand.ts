import { Message } from 'discord.js';
import { CotRanks, GuildIds, UserIds } from '../../../consts';
import COTMember from '../../../entity/COTMember';
import { ISassybotCommandParams } from '../../../Sassybot';
import SassybotCommand from '../SassybotCommand';

export default abstract class ActivityCommand extends SassybotCommand {
  public getHelpText(): string {
    return `usage: \`!{sassybot|sb} ${this.commands.join(', ')}\` -- @Sasner#1337 you should really fill this out`;
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (!message.guild || !message.member) {
      return;
    }
    const OfficerRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    if (
      (OfficerRole && message.member.roles.highest.comparePositionTo(OfficerRole) >= 0) ||
      message.author.id === UserIds.SASNER
    ) {
      await this.listAll(message);
    } else {
      await this.activityListener({ message, params });
    }
  }

  protected async requestCharacterName(message: Message) {
    await message.channel.send('First, Tell Me Your Full Character Name');
  }

  protected async parseCharacterName(message: Message): Promise<COTMember> {
    const declaredName = message.cleanContent;
    return await COTMember.getCotMemberByName(declaredName, message.author.id);
  }

  protected abstract activityListener({
    message,
    params,
  }: {
    message: Message;
    params: ISassybotCommandParams;
  }): Promise<void>;

  protected abstract listAll(message: Message): Promise<void>;
}
