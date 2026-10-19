import {
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import type { Sassybot } from '../../Sassybot';
import SassybotEventListener from '../SassybotEventListener';

export default abstract class SassybotCommand extends SassybotEventListener {
  public abstract readonly commands: string[];

  constructor(sb: Sassybot) {
    super(sb, 'sassybotCommand');
    this.sb.on(
      'sassybotHelpCommand',
      ({ interaction, command }: { interaction: ChatInputCommandInteraction; command: string }) => {
        void this.displayHelpText.bind(this)({ interaction, command });
      },
    );
  }

  public getEventListener(): ({ interaction }: { interaction: ChatInputCommandInteraction }) => Promise<void> {
    return this.onEventCallback.bind(this);
  }

  public getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return this.commands.map((commandName) =>
      new SlashCommandBuilder()
        .setName(commandName.toLowerCase())
        .setDescription(this.getHelpText().slice(0, 100))
        .toJSON(),
    );
  }

  protected abstract listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void>;
  protected abstract getHelpText(): string;

  public async displayHelpText({
    interaction,
    command,
  }: {
    interaction: ChatInputCommandInteraction;
    command: string;
  }): Promise<void> {
    const helpText = this.getHelpText().trim();
    if (helpText === '') {
      // don't bother
      return;
    }

    const commandsListenedFor = this.commands.map((c) => c.toLowerCase());
    if (commandsListenedFor.includes(command.toLowerCase().trim())) {
      await interaction.reply(helpText);
    }
  }

  private async onEventCallback({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const invoked = interaction.commandName.toLowerCase();
    const commands = this.commands.map((c) => c.toLowerCase());
    if (commands.includes(invoked)) {
      try {
        this.sb.logger.info(`Command Invoked: ${invoked}`, {
          commandName: interaction.commandName,
          options: interaction.options.data,
          author: interaction.user.displayName,
        });
        await this.listener({ interaction });
      } catch (e: unknown) {
        this.sb.logger.error(`Error Processing ${invoked}`, { e, interaction });
      }
    }
  }
}
