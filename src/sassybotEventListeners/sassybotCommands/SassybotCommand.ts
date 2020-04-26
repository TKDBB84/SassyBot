import { Message } from 'discord.js';
import { logger } from '../../log';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotEventListener from '../SassybotEventListener';

export default abstract class SassybotCommand extends SassybotEventListener {
  public abstract readonly command: string;
  public readonly event = 'sassybotCommand';

  public getEventListener(): (...args: any) => Promise<void> {
    return this.onEventCallback.bind(this);
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
      try {
        await this.listener({ message, params });
      } catch (e) {
        logger.warn(`Error Processing ${this.command}`, message, params);
      }
    }
    if (params.command.toLowerCase() === 'help' && params.args.toLowerCase() === this.command.toLowerCase()) {
      await message.channel.send(this.getHelpText(), {
        split: {
          char: ' ',
        },
      });
    }
  }
}
