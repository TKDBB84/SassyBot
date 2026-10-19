import {
  ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import SassybotCommand from './SassybotCommand';

export default class EchoCommand extends SassybotCommand {
  public getHelpText(): string {
    return 'usage: `/echo message:{message}` -- I reply with the same message you sent me, Sasner generally uses this for debugging';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('echo')
        .setDescription('Reply with the same message you sent')
        .addStringOption((option) => option.setName('message').setDescription('The message to echo').setRequired(true))
        .toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const message = interaction.options.getString('message', true);
    await interaction.reply({
      content: message,
    });
  }
}
