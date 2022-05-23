import { Message } from 'discord.js';
import { UserIds } from '../../consts';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';
import { inspect } from 'util';

export default class EvalCommand extends SassybotCommand {
  public readonly commands = ['eval'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} eval [your valid JS string here] --- only available to Sasner`';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (
      message.author.id === UserIds.SASNER ||
      message.author.id === UserIds.RYK ||
      message.author.id === UserIds.CAIT
    ) {
      if (message.author.id !== UserIds.SASNER) {
        await message.reply("I sure hope you know what you're doing...");
        const forUser = message.author.id === UserIds.CAIT ? 'Cait' : 'Ryk';
        const log = `Running Eval'd: ${params.args} for ${forUser}`;
        this.sb.logger.warn(log, { message, params, forUser });
      }
      // tslint:disable-next-line:no-eval
      // eslint-disable-next-line no-eval, @typescript-eslint/no-unsafe-assignment
      const evalResult = eval(params.args);
      let result: string;
      if (typeof evalResult !== 'string') {
        result = inspect(evalResult);
      } else {
        result = evalResult;
      }
      await message.channel.send(result);
    }
  }
}
