import {
  ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import { GuildIds } from '../../consts';
import SassybotCommand from './SassybotCommand';
import { isMessageFromAdmin } from './lib';
import { inspect } from 'util';

export default class EvalCommand extends SassybotCommand {
  public readonly commands = ['eval'];
  public override readonly guildId = GuildIds.SASNERS_TEST_SERVER_GUILD_ID;

  public getHelpText(): string {
    return 'usage: `/eval code:[your valid JS string here]` --- only available to Sasner';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('eval')
        .setDescription('Evaluate a JavaScript string (Sasner only)')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((option) =>
          option.setName('code').setDescription('Your valid JS string here').setRequired(true),
        )
        .toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    if (!isMessageFromAdmin(interaction)) {
      await interaction.reply({
        content: 'Sorry, only Sasner is allowed to run eval.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const code = interaction.options.getString('code', true);
    await interaction.deferReply();

    try {
      // tslint:disable-next-line:no-eval
      const evalResult: unknown = await eval(code);
      let result = typeof evalResult === 'string' ? evalResult : inspect(evalResult);
      if (!result) {
        result = '(empty output)';
      }
      if (result.length > 1900) {
        result = `${result.slice(0, 1900)}\n... (truncated)`;
      }
      await interaction.editReply(`\`\`\`js\n${result}\n\`\`\``);
    } catch (err: unknown) {
      const errText = err instanceof Error ? (err.stack ?? err.message) : inspect(err);
      await interaction.editReply(`\`\`\`js\nError: ${errText.slice(0, 1900)}\n\`\`\``);
    }
  }
}
