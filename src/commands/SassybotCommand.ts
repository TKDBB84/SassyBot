import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type MessageContextMenuCommandInteraction,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';
import type { Sassybot } from '../Sassybot';

export default abstract class SassybotCommand {
  protected sb: Sassybot;
  public readonly guildId?: string;

  constructor(sb: Sassybot) {
    this.sb = sb;
  }

  public abstract getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[];

  public getContextMenuCommands(): RESTPostAPIContextMenuApplicationCommandsJSONBody[] {
    return [];
  }

  protected abstract listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void>;
  protected abstract getHelpText(): string;

  public async autocomplete({ interaction }: { interaction: AutocompleteInteraction }): Promise<void> {
    await interaction.respond([]);
  }

  public async contextMenuListener({
    interaction,
  }: {
    interaction: MessageContextMenuCommandInteraction;
  }): Promise<void> {
    await interaction.reply({
      content: 'This context menu command is not implemented.',
      flags: MessageFlags.Ephemeral,
    });
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
      this.sb.logger.error(`Error Processing ${invoked}`, {
        error: e,
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        options: interaction.options.data,
      });
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

  public async executeContextMenu({
    interaction,
  }: {
    interaction: MessageContextMenuCommandInteraction;
  }): Promise<void> {
    const invoked = interaction.commandName;
    try {
      this.sb.logger.info(`Context Menu Command Invoked: ${invoked}`, {
        commandName: interaction.commandName,
        targetId: interaction.targetId,
        author: interaction.user.displayName,
      });
      await this.contextMenuListener({ interaction });
    } catch (e: unknown) {
      this.sb.logger.error(`Error Processing Context Menu ${invoked}`, {
        error: e,
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        targetId: interaction.targetId,
      });
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
