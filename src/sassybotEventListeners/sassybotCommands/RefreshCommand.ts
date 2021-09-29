import { Message } from 'discord.js';
import SassybotCommand from './SassybotCommand';
import {UserIds} from "../../consts";
import jobs from "../../cronJobs";

export default class RefreshCommand extends SassybotCommand {
  public readonly commands = ['refresh'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} refresh` -- re-import all CoT members into Sassybots Database. Only Executable By Sasner.';
  }

  protected async listener({ message }: { message: Message; }): Promise<void> {
    if (message.author.id === UserIds.SASNER) {
      await jobs[0].job(this.sb)
      await message.reply('Done');
    }
  }
}
