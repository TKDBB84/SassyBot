import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { CotRanks, GuildIds, UserIds } from '../../consts';

export default class RestartCommand extends SassybotCommand {
  public readonly commands = ['restart', 'reboot'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} restart` -- I force a bot restart';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    let isDiscordOfficer = [UserIds.SASNER.toString(), UserIds.CAIT.toString()].includes(message.author.id.toString());
    if (!isDiscordOfficer && message.guild?.id === GuildIds.COT_GUILD_ID && message.member) {
      const OFFICER = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);
      if (OFFICER) {
        isDiscordOfficer = CotRanks.OFFICER && message.member?.roles.highest.comparePositionTo(OFFICER) >= 0;
      }
    }

    if (isDiscordOfficer) {
      await message.channel.send('restarting...');
      process.exit(1); // exit w/ error so PM2 restarts us.
      return;
    }
    await message.channel.send('Sorry Only Admins are allow to restart the bot.');
  }
}
