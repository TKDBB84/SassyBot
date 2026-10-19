import {
  ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import { GuildIds } from '../consts';
import SassybotCommand from './SassybotCommand';
import { isInteractionFromAdmin } from './lib';

export default class RestartCommand extends SassybotCommand {
  public override readonly guildId = GuildIds.SASNERS_TEST_SERVER_GUILD_ID;

  public getHelpText(): string {
    return 'usage: `/restart` -- I force a bot restart';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Force a bot restart (Sasner only)')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    if (isInteractionFromAdmin(interaction)) {
      await interaction.reply({
        content: 'restarting...',
        flags: MessageFlags.Ephemeral,
      });
      setTimeout(() => {
        process.exit(1); // exit w/ error so PM2 restarts us.
      }, 500);
      return;
    }
    await interaction.reply({
      content: 'Sorry, only Sasner is allowed to restart the bot.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
