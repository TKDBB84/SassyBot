import {
  ChatInputCommandInteraction,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import { UserIds } from '../consts';
import SassybotCommand from './SassybotCommand';

export default class HelpCommand extends SassybotCommand {
  public getHelpText(): string {
    return 'usage: `/help [command]` -- I display a list of commands, and can take an optional argument for more details of a command';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    const globalChoices = [...this.sb.getCommandsMap().entries()]
      .filter(([name, cmd]) => !cmd.guildId && name !== 'help')
      .map(([name]) => ({ name: `/${name}`, value: name }))
      .sort((a, b) => a.value.localeCompare(b.value));

    return [
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display a list of available commands or details about a specific command')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('The command to get help for')
            .setRequired(false)
            .addChoices(...globalChoices.slice(0, 25)),
        )
        .toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const commandArg = (interaction.options.getString('command') ?? '').toLowerCase().trim().replace(/^\//, '');
    const commandsMap = this.sb.getCommandsMap();
    const isVisible = (cmd: SassybotCommand) =>
      !cmd.guildId || (interaction.guildId === cmd.guildId && interaction.user.id === UserIds.SASNER);

    if (commandArg === '') {
      const commands: string[] = [...commandsMap.entries()]
        .filter(([name, cmd]) => name !== 'help' && isVisible(cmd))
        .map(([name]) => name);
      commands.sort();
      await interaction.reply({
        content: `Available commands are:\n${commands.map((c) => `\`/${c}\``).join(', ')}\n for more information, you can specify \`/help command:[command]\` to get more information about that command`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const command = commandsMap.get(commandArg);
    if (command && isVisible(command)) {
      await command.displayHelpText({ interaction });
    } else {
      await interaction.reply({
        content: `Unknown command \`/${commandArg}\`. Run \`/help\` to see available commands.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
