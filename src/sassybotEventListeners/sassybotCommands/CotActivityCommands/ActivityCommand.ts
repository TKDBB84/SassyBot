import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../../Sassybot';
import SassybotCommand from '../SassybotCommand';
import { IActivityList } from '../../CotActivityListeners/ActivityResponseListener';
import { CotRanks, GuildIds } from '../../../consts';

export default abstract class ActivityCommand extends SassybotCommand {
  public getHelpText(): string {
    return `usage: \`!{sassybot|sb} ${this.command}\` -- something something something`;
  }

  protected abstract async activityCommandListener({
    message,
    params,
  }: {
    message: Message;
    params: ISassybotCommandParams;
  }): Promise<void>;

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const OfficerRole = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
    if (OfficerRole && message.member.highestRole.comparePositionTo(OfficerRole) >= 0) {
      await this.listAll(message);
    } else {
      await this.activityCommandListener({ message, params });
    }
  }

  protected abstract async listAll(message: Message): Promise<void>;
}
