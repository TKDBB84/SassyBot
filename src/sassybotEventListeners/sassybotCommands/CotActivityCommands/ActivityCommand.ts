import { Message } from 'discord.js';
import { CotRanks, GuildIds, UserIds } from '../../../consts';
import COTMember from '../../../entity/COTMember';
import { ISassybotCommandParams } from '../../../Sassybot';
import SassybotCommand from '../SassybotCommand';

export default abstract class ActivityCommand extends SassybotCommand {
  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    return;
    // if (!message.guild || !message.member) {
    //   return;
    // }
    // const officerRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    // if (
    //   (officerRole && message.member.roles.highest.comparePositionTo(officerRole) >= 0) ||
    //   message.author.id === UserIds.SASNER
    // ) {
    //   await this.listAll(message);
    // } else {
    //   await this.activityListener({ message, params });
    // }
  }

  protected async requestCharacterName(message: Message): Promise<void> {
    if (!message.channel.isSendable()) {
      return;
    }
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
