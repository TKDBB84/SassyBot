import {
  ChatInputCommandInteraction,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import { UserIds } from '../../consts';
import SassybotCommand from './SassybotCommand';
import { inspect } from 'util';

export default class EvalCommand extends SassybotCommand {
  public readonly commands = ['eval'];

  public getHelpText(): string {
    return 'usage: `/eval code:[your valid JS string here]` --- only available to Sasner';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('eval')
        .setDescription('Evaluate a JavaScript string (Sasner only)')
        .addStringOption((option) =>
          option.setName('code').setDescription('Your valid JS string here').setRequired(true),
        )
        .toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const code = interaction.options.getString('code', true);
    if (
      interaction.user.id === UserIds.SASNER ||
      interaction.user.id === UserIds.RYK ||
      interaction.user.id === UserIds.CAIT
    ) {
      const isNonSasnerAdmin = interaction.user.id !== UserIds.SASNER;
      if (isNonSasnerAdmin) {
        await interaction.reply("I sure hope you know what you're doing...");
        const forUser = interaction.user.id === UserIds.CAIT ? 'Cait' : 'Ryk';
        const log = `Running Eval'd: ${code} for ${forUser}`;
        this.sb.logger.warn(log, { interaction, code, forUser });
      }
      // tslint:disable-next-line:no-eval

      const evalResult = eval(code);
      let result: string;
      if (typeof evalResult !== 'string') {
        result = inspect(evalResult);
      } else {
        result = evalResult;
      }
      if (isNonSasnerAdmin) {
        await interaction.followUp(result);
      } else {
        await interaction.reply(result);
      }
    } else {
      await interaction.reply({
        content: 'Sorry, only Sasner is allowed to run eval.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
