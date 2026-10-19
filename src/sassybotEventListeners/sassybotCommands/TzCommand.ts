import {
  ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import SbUser from '../../entity/SbUser';
import SassybotCommand from './SassybotCommand';

export default class TzCommand extends SassybotCommand {
  private static wikiLink = 'https://en.wikipedia.org/wiki/List_of_tz_database_time_zones';
  public readonly commands = ['tz'];

  public getHelpText(): string {
    return (
      'usage: `/tz [timezone:{iana timezone name}]` --- a complete list of timezones can be found here\n' +
      TzCommand.wikiLink +
      '\n please use the the name from the "TZ database name" column'
    );
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('tz')
        .setDescription('Get or set your IANA timezone')
        .addStringOption((option) =>
          option.setName('timezone').setDescription('IANA timezone name (e.g. America/New_York)').setRequired(false),
        )
        .toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const userRepository = this.sb.dbConnection.getRepository(SbUser);
    let currentUser = await userRepository.findOne({ where: { discordUserId: interaction.user.id } });
    if (!currentUser) {
      currentUser = new SbUser();
      currentUser.discordUserId = interaction.user.id;
    }
    const tzParam = (interaction.options.getString('timezone') ?? '').trim();
    if (tzParam === '' && !currentUser.timezone) {
      await interaction.reply(`You must provide a timezone to set. \n ${this.getHelpText()}`);
      return;
    } else if (tzParam) {
      // return current timezone
      const newTz = tzParam.toLowerCase();
      if (!moment.tz.zone(newTz)) {
        await interaction.reply(
          "Sorry, that doesn't appear to be a timezone I know, there's a full list of valid timezones here:\n" +
            TzCommand.wikiLink,
        );
        return;
      }
      currentUser.timezone = newTz;
      currentUser = await userRepository.save(currentUser, { reload: true });
    }
    await interaction.reply(
      `I have your timezone as: \`${currentUser.timezone}\` your local time should be: ${moment()
        .tz(currentUser.timezone)
        .format('LT')}`,
    );
  }
}
