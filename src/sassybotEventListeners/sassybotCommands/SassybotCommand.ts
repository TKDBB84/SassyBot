import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import type { Sassybot } from '../../Sassybot';
import SassybotEventListener from '../SassybotEventListener';

export default abstract class SassybotCommand extends SassybotEventListener {
  public abstract readonly commands: string[];
  public readonly guildId?: string;

  constructor(sb: Sassybot) {
    super(sb);
  }

  public getEventListener(): ({ interaction }: { interaction: ChatInputCommandInteraction }) => Promise<void> {
    return this.execute.bind(this);
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

  public async autocomplete({ interaction }: { interaction: AutocompleteInteraction }): Promise<void> {
    await interaction.respond([]);
  }

  public async displayHelpText({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const helpText = this.getHelpText().trim();
    if (helpText === '') {
      await interaction.reply({
        content: 'No help text available for this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: helpText,
      flags: MessageFlags.Ephemeral,
    });
  }

  public async execute({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const invoked = interaction.commandName.toLowerCase();
    try {
      this.sb.logger.info(`Command Invoked: ${invoked}`, {
        commandName: interaction.commandName,
        options: interaction.options.data,
        author: interaction.user.displayName,
      });
      await this.listener({ interaction });
    } catch (e: unknown) {
      this.sb.logger.error(`Error Processing ${invoked}`, { e, interaction });
      try {
        const errorPayload = {
          content: 'An error occurred while executing this command.',
          flags: MessageFlags.Ephemeral,
        } as const;
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorPayload);
        } else {
          await interaction.reply(errorPayload);
        }
      } catch (replyError: unknown) {
        this.sb.logger.error(`Failed to send error reply for ${invoked}`, { replyError });
      }
    }
  }
}
