import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotEventListener from '../SassybotEventListener';

export default abstract class SassybotCommand extends SassybotEventListener {
  public abstract readonly commands: string[];
  public readonly event = 'sassybotCommand';

  public getEventListener(): (...args: any) => Promise<void> {
    return this.onEventCallback.bind(this);
  }

  protected abstract listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void>;
  protected abstract getHelpText(): string;

  public async displayHelpText({message, params}: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    const invoked = params.command.toLowerCase();
    const commands = this.commands.map((c) => c.toLowerCase());
    if (invoked === 'help' && commands.includes(params.args.toLowerCase())) {
      await message.channel.send(this.getHelpText(), {
        split: {
          char: ' ',
        },
      });
    }
  }

  private async onEventCallback({
    message,
    params,
  }: {
    message: Message;
    params: ISassybotCommandParams;
  }): Promise<void> {
    const invoked = params.command.toLowerCase();
    const commands = this.commands.map((c) => c.toLowerCase());
    if (commands.includes(invoked)) {
      try {
        await this.listener({ message, params });
      } catch (e) {
        this.sb.logger.error(`Error Processing ${invoked}`, { e, message, params });
      }
    }
    if (invoked === 'help' && commands.includes(params.args.toLowerCase())) {
      await message.channel.send(this.getHelpText(), {
        split: {
          char: ' ',
        },
      });
    }
  }
}
