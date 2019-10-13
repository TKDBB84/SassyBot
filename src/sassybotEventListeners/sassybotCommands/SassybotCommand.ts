import { Message } from 'discord.js';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotEventListener from '../SassybotEventListener';

export default abstract class SassybotCommand extends SassybotEventListener {
  public abstract readonly command: string;
  public readonly event = 'sassybotCommand';

  public getEventListener(): (...args: any) => Promise<void> {
    return this.onEventCallback;
  }

  protected abstract async listener({
    message,
    params,
  }: {
    message: Message;
    params: ISassybotCommandParams;
  }): Promise<void>;

  protected abstract getHelpText(): string;

  private async onEventCallback({
    message,
    params,
  }: {
    message: Message;
    params: ISassybotCommandParams;
  }): Promise<void> {
    if (params.command.toLowerCase() === this.command.toLowerCase()) {
      await this.listener({ message, params });
    }
    if (params.command.toLowerCase() === 'help' && params.args[0].toLowerCase() === this.command.toLowerCase()) {
      message.channel.send(this.getHelpText(), {
        split: true,
      });
    }
  }
}
