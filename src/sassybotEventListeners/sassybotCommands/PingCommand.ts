import {
  ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import SassybotCommand from './SassybotCommand';

export default class PingCommand extends SassybotCommand {
  public readonly commands = ['ping'];

  public getHelpText(): string {
    return 'usage: `/ping` -- I reply with "pong" this is a good test to see if i\'m listening at all';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Reply with "pong" to test if Sassybot is listening')
        .toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    await interaction.reply({ content: 'pong' });
  }
}
