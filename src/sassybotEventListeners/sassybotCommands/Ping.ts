import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class Echo extends SassybotCommand {
  public readonly command = 'ping';

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} ping` -- I reply with "pong" this is a good test to see if i\'m listening at all';
  }

  protected async listener(message: Message, params: ISassybotCommandParams): Promise<void> {
    await message.channel.send('pong', {
      disableEveryone: true,
      reply: message.author,
      split: true,
    });
  }
}
