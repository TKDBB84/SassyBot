import {
  type AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import SbUser from '../../entity/SbUser';
import SassybotCommand from './SassybotCommand';

export default class TzCommand extends SassybotCommand {
  private static wikiLink = 'https://en.wikipedia.org/wiki/List_of_tz_database_time_zones';
  private static readonly allTimezones = moment.tz.names();

  public getHelpText(): string {
    return (
      'usage: `/tz [timezone:{iana timezone name}]` --- a complete list of timezones can be found here\n' +
      TzCommand.wikiLink +
      '\n please use the name from the "TZ database name" column'
    );
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('tz')
        .setDescription('Get or set your IANA timezone')
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('IANA timezone name (e.g. America/New_York)')
            .setRequired(false)
            .setAutocomplete(true),
        )
        .toJSON(),
    ];
  }

  public override async autocomplete({ interaction }: { interaction: AutocompleteInteraction }): Promise<void> {
    const focused = interaction.options.getFocused().toLowerCase().trim();
    const matches = TzCommand.allTimezones
      .filter((tz) => (focused ? tz.toLowerCase().includes(focused) : tz.includes('/')))
      .slice(0, 25)
      .map((tz) => ({ name: tz, value: tz }));
    await interaction.respond(matches);
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const tzParam = (interaction.options.getString('timezone') ?? '').trim();
    const zone = tzParam ? moment.tz.zone(tzParam) : null;
    if (tzParam && !zone) {
      await interaction.reply({
        content:
          "Sorry, that doesn't appear to be a timezone I know, there's a full list of valid timezones here:\n" +
          TzCommand.wikiLink,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userRepository = this.sb.dbConnection.getRepository(SbUser);
    if (zone) {
      await interaction.deferReply();
      let currentUser = await userRepository.findOne({ where: { discordUserId: interaction.user.id } });
      if (!currentUser) {
        currentUser = new SbUser();
        currentUser.discordUserId = interaction.user.id;
      }
      currentUser.timezone = zone.name;
      currentUser = await userRepository.save(currentUser, { reload: true });
      await interaction.editReply(
        `I have your timezone as: \`${currentUser.timezone}\` your local time should be: ${moment()
          .tz(currentUser.timezone)
          .format('LT')}`,
      );
      return;
    }

    const currentUser = await userRepository.findOne({ where: { discordUserId: interaction.user.id } });
    if (!currentUser?.timezone) {
      await interaction.reply({
        content: `You must provide a timezone to set. \n ${this.getHelpText()}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply(
      `I have your timezone as: \`${currentUser.timezone}\` your local time should be: ${moment()
        .tz(currentUser.timezone)
        .format('LT')}`,
    );
  }
}
