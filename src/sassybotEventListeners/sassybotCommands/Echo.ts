import SassybotCommand from './SassybotCommand';
import { ISassybotCommandParams } from '../../Sassybot';
import { Message } from 'discord.js';

export default class Echo extends SassybotCommand {
  public readonly command = 'echo';

  getHelpText(): string {
    return 'usage: `!{sassybot|sb} echo {message}` -- I reply with the same message you sent me, Sasner generally uses this for debugging';
  }

  protected async listener(message: Message, params: ISassybotCommandParams): Promise<void> {
    await message.channel.send(params.args, {
      disableEveryone: true,
      split: true,
    });
  }
}
