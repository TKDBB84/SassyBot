import {
  ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import SassybotCommand from './SassybotCommand';
import { isMessageFromAdmin } from './lib';
import { CotRanks, GuildIds } from '../../consts';

export default class RestartCommand extends SassybotCommand {
  public readonly commands = ['restart'];

  public getHelpText(): string {
    return 'usage: `/restart` -- I force a bot restart';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [new SlashCommandBuilder().setName('restart').setDescription('Force a bot restart (Admin only)').toJSON()];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const officer = await this.sb.getRole(GuildIds.COT_GUILD_ID, CotRanks.OFFICER);

    if (isMessageFromAdmin(interaction, officer)) {
      await interaction.reply('restarting...');
      process.exit(1); // exit w/ error so PM2 restarts us.
      return;
    }
    await interaction.reply('Sorry Only Admins are allow to restart the bot.');
  }
}
