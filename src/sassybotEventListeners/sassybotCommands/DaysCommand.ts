import { Message } from 'discord.js';
import SassybotCommand from './SassybotCommand';

export default class DaysCommand extends SassybotCommand {
  public readonly commands = ['days', 'day'];

  public getHelpText(): string {
    return "usage: `!{sassybot|sb} days` -- I dont do this anymore because Sasner is too stupid to make it work.";
  }

  protected async listener({ message }: { message: Message; }): Promise<void> {
    if (!message.guild || !message.member) {
      return;
    }

    if (!message.channel.isSendable()) {
      return;
    }

    await message.channel.send('Sorry, Sasner is too stupid to figure out day tracking so idk');
  }
}
