import type { Message } from 'discord.js';
import type { ISassybotCommandParams, Sassybot } from '../../Sassybot';
import SassybotEventListener from '../SassybotEventListener';

export default abstract class SassybotCommand extends SassybotEventListener {
  public abstract readonly commands: string[];

  constructor(sb: Sassybot) {
    super(sb, 'sassybotCommand');
    this.sb.on('sassybotHelpCommand', ({ message, params }: { message: Message; params: ISassybotCommandParams }) => {
      void this.displayHelpText.bind(this)({ message, params });
    });
  }

  public getEventListener(): ({
    message,
    params,
  }: {
    message: Message;
    params: ISassybotCommandParams;
  }) => Promise<void> {
    return this.onEventCallback.bind(this);
  }

  protected abstract listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void>;
  protected abstract getHelpText(): string;

  public async displayHelpText({
    message,
    params,
  }: {
    message: Message;
    params: ISassybotCommandParams;
  }): Promise<void> {
    const helpText = this.getHelpText().trim();
    if (helpText === '') {
      // don't bother
      return;
    }

    const invokedCommand = params.command.toLowerCase();
    const commandsListenedFor = this.commands.map((c) => c.toLowerCase());
    if (invokedCommand === 'help' && commandsListenedFor.includes(params.args.toLowerCase().trim())) {
      await message.channel.send(helpText);
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
        this.sb.logger.info(`Command Invoked: ${invoked}`, {
          message: message.cleanContent,
          author: message.author.displayName,
          params,
        });
        await this.listener({ message, params });
      } catch (e: unknown) {
        this.sb.logger.error(`Error Processing ${invoked}`, { e, message, params });
      }
    }
    if (invoked === 'help' && commands.includes(params.args.toLowerCase())) {
      await message.channel.send(this.getHelpText());
    }
  }
}
