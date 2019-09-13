import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../../Sassybot';
import SassybotCommand from '../SassybotCommand';

export default class Echo extends SassybotCommand {
  public readonly command = 'quote';

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} quote {@User}` -- This command causes me to search through this room\'s chat history (last 50 messages) for a message sent by the specified @User, which as a :quote: reaction from you, and record that message.';
  }

  protected async listener({message, params}: {message: Message, params: ISassybotCommandParams}): Promise<void> {
    // fuck idk do something
  }
}
