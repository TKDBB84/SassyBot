import {
  type AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import moment from 'moment';
import 'moment-timezone';
import SbUser from '../entity/SbUser';
import SassybotCommand from './SassybotCommand';

export default class TzCommand extends SassybotCommand {
  private static wikiLink = 'https://en.wikipedia.org/wiki/List_of_tz_database_time_zones';
  private static readonly allTimezones = moment.tz.names();
  private static readonly defaultTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Halifax',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Dublin',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Amsterdam',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Stockholm',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Singapore',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];

  public getHelpText(): string {
    return (
      'usage: `/tz [timezone:{iana timezone name}] [user:@User]` --- a complete list of timezones can be found here\n' +
      TzCommand.wikiLink +
      '\n please use the name from the "TZ database name" column'
    );
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('tz')
        .setDescription("Get or set your IANA timezone, or check another user's local time")
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('IANA timezone name to set for yourself (e.g. America/New_York)')
            .setRequired(false)
            .setAutocomplete(true),
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User whose timezone and local time you want to check')
            .setRequired(false),
        )
        .toJSON(),
    ];
  }

  public override async autocomplete({ interaction }: { interaction: AutocompleteInteraction }): Promise<void> {
    const focused = interaction.options.getFocused().toLowerCase().trim();
    if (!focused) {
      await interaction.respond(TzCommand.defaultTimezones.map((tz) => ({ name: tz, value: tz })));
      return;
    }

    const prefixMatches: string[] = [];
    const substringMatches: string[] = [];
    for (const tz of TzCommand.allTimezones) {
      const lower = tz.toLowerCase();
      if (lower.startsWith(focused) || lower.split('/').some((part) => part.startsWith(focused))) {
        prefixMatches.push(tz);
      } else if (lower.includes(focused)) {
        substringMatches.push(tz);
      }
    }

    const matches = [...prefixMatches, ...substringMatches].slice(0, 25).map((tz) => ({ name: tz, value: tz }));
    await interaction.respond(matches);
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    const tzParam = (interaction.options.getString('timezone') ?? '').trim();
    const targetUser = interaction.options.getUser('user');

    if (tzParam && targetUser && targetUser.id !== interaction.user.id) {
      await interaction.reply({
        content: "You can only set your own timezone. Omit `timezone` to check another user's local time.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

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

    await interaction.deferReply();
    const lookupUser = targetUser ?? interaction.user;
    const lookedUpSbUser = await userRepository.findOne({ where: { discordUserId: lookupUser.id } });
    if (!lookedUpSbUser?.timezone) {
      if (targetUser && targetUser.id !== interaction.user.id) {
        await interaction.editReply(`${targetUser.displayName} has not set a timezone yet.`);
      } else {
        await interaction.editReply(`You must provide a timezone to set. \n ${this.getHelpText()}`);
      }
      return;
    }

    if (targetUser && targetUser.id !== interaction.user.id) {
      await interaction.editReply(
        `I have ${targetUser.displayName}'s timezone as: \`${lookedUpSbUser.timezone}\` their local time should be: ${moment()
          .tz(lookedUpSbUser.timezone)
          .format('LT')}`,
      );
      return;
    }

    await interaction.editReply(
      `I have your timezone as: \`${lookedUpSbUser.timezone}\` your local time should be: ${moment()
        .tz(lookedUpSbUser.timezone)
        .format('LT')}`,
    );
  }
}
