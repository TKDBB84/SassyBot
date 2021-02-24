import { Message } from 'discord.js';
import { CotRanks, GuildIds, UserIds } from '../../../consts';
import COTMember from '../../../entity/COTMember';
import { ISassybotCommandParams } from '../../../Sassybot';
import SassybotCommand from '../SassybotCommand';
import SbUser from "../../../entity/SbUser";
import FFXIVChar from "../../../entity/FFXIVChar";

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
      await this.activityListener({ message });
    }
  }

  protected async requestCharacterName(message: Message) {
    await message.channel.send('First, Tell Me Your Full Character Name');
  }

  protected async parseCharacterName(message: Message): Promise<COTMember> {
    const declaredName = message.cleanContent;
    const sbUser = await SbUser.findOrCreateUser(message.author.id)
    const ffXivCharacter = await FFXIVChar.findOrCreateCharacter(declaredName, sbUser)
    let cotMember = await this.sb.dbConnection.getRepository<COTMember>(COTMember).findOne({where: {character: { id: ffXivCharacter.id}}})
    if (!cotMember) {
      await message.channel.send("I dont see you as a CoT Member, maybe lodestone hasn't updated yet? @Sasner#1337 can probably help too.")
      throw new Error('Cannot_Find_Member')
    }
    return cotMember
  }

  protected abstract activityListener({ message }: { message: Message }): Promise<void>;

  protected abstract listAll(message: Message): Promise<void>;
}
