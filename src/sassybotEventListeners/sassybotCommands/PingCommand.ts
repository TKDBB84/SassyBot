import { Message } from 'discord.js';
import SassybotCommand from './SassybotCommand';

export default class PingCommand extends SassybotCommand {
  public readonly commands = ['ping'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} ping` -- I reply with "pong" this is a good test to see if i\'m listening at all';
  }

  protected async listener({ message }: { message: Message }): Promise<void> {
    if (!message.channel.isSendable()) {
      return;
    }

    await message.channel.send({ content: 'pong', reply: { messageReference: message } });
  }
}
