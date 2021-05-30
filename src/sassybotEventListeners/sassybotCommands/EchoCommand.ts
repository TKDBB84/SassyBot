import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class EchoCommand extends SassybotCommand {
  public readonly commands = ['echo'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} echo {message}` -- I reply with the same message you sent me, Sasner generally uses this for debugging';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    await message.channel.send(params.args, {
      split: true,
    });
    this.sb.logger.info(`info level echo ${params.args}`, { meta: 'data2' });
    this.sb.logger.warn(`warn level echo ${params.args}`, { meta: 'data3' });
    this.sb.logger.error(`error level echo ${params.args}`, { meta: 'data5' });
  }
}
