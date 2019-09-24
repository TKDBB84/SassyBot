import {Message} from 'discord.js';
import { CotRanks, GuildIds } from '../../../consts';
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
      await this.activityListener({message});
    }
  }

  protected async requestCharacterName(message: Message) {
    message.channel.send('First, Tell Me Your Full Character Name');
  }

  protected abstract async parseCharacterName(message: Message): Promise<void>;

  protected abstract async activityListener({ message }: { message: Message }): Promise<void>;

  protected abstract async listAll(message: Message): Promise<void>;

  protected abstract async summarizeData(message: Message): Promise<void>;
}
