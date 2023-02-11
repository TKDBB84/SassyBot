import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class EchoCommand extends SassybotCommand {
  public readonly commands = ['pas'];

  public getHelpText(): string {
    return 'NTSH';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    await message.channel.send({
      content: 'No, you shut the fuck up and deal with the promotions..... fucking whiner.',
      reply: { messageReference: '1074058437144612914' },
    });
  }
}
