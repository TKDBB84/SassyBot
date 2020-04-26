import { Message } from 'discord.js';
import { UserIds } from '../../consts';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class EvalCommand extends SassybotCommand {
  public readonly commands = ['eval'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} eval [your valid JS string here]`';
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
        const sasner = await this.sb.getUser(UserIds.SASNER);
        if (sasner) {
          const sasnerDm = await sasner.createDM();
          await sasnerDm.send(`eval-ing code for ${forUser} \`\`\`js\n${params.args}\n\`\`\``);
        }
        console.log(log, { message });
      }
      // tslint:disable-next-line:no-eval
      let result = eval(params.args);
      if (typeof result !== 'string') {
        result = require('util').inspect(result);
      }
      await message.channel.send(result);
    }
  }
}
