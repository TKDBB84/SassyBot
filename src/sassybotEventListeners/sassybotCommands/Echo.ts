import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class Echo extends SassybotCommand {
  public readonly command = 'echo';

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} echo {message}` -- I reply with the same message you sent me, Sasner generally uses this for debugging';
  }

  protected async listener({message, params}: {message: Message, params: ISassybotCommandParams}): Promise<void> {
    await message.channel.send(params.args, {
      disableEveryone: true,
      split: true,
    });
  }
}
