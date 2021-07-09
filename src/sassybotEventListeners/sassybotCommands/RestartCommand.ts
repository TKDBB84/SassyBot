import { Message } from 'discord.js';
import SassybotCommand from './SassybotCommand';
import { isMessageFromAdmin } from './lib';
import { CotRanks, GuildIds } from '../../consts';

export default class RestartCommand extends SassybotCommand {
  public readonly commands = ['restart', 'reboot'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} restart` -- I force a bot restart';
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    const officer = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);

    if (isMessageFromAdmin(message, officer)) {
      await message.channel.send('restarting...');
      process.exit(1); // exit w/ error so PM2 restarts us.
      return;
    }
    await message.channel.send('Sorry Only Admins are allow to restart the bot.');
  }
}
