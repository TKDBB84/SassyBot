import { ISassyBotCommandParams, SassyBot } from './SassyBot';
import { Message } from 'discord.js';

export default abstract class SassybotCommand {
  protected sb: SassyBot;
  protected abstract command: string;

  constructor(sb: SassyBot) {
    this.sb = sb;
    this.init();
  }

  protected init() {
    this.sb.on('sassybotCommand', this.onEvent);
  }

  private async onEvent(message: Message, params: ISassyBotCommandParams) {
    if (params.command.toLowerCase() === this.command.toLowerCase()) {
      await this.listener(message, params)
    }
    if (params.command.toLowerCase() === 'help') {
      message.channel.send(this.getHelpText(), {
        disableEveryone: true,
        split: true,
      })
    }
  }
  protected abstract async listener(message: Message, params: ISassyBotCommandParams): Promise<void>;
  protected abstract getHelpText(): string
}
