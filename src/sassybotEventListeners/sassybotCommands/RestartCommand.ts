import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { UserIds } from '../../consts';

export default class RestartCommand extends SassybotCommand {
  public readonly commands = ['restart', 'reboot'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} restart` -- I force a bot restart';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if ([UserIds.SASNER.toString(), UserIds.CAIT.toString()].includes(message.author.id.toString())) {
      await message.channel.send('restarting...');
      process.exit(1); // exit w/ error so PM2 restarts us.
      return
    }
    await message.channel.send('Sorry Only Admins are allow to restart the bot.')
  }
}
