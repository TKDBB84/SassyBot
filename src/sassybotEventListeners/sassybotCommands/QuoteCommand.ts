import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import Quote from '../../entity/Quote';
import SassybotCommand from './SassybotCommand';

export default class QuoteCommand extends SassybotCommand {
  public readonly commands = ['quote'];

  public getHelpText(): string {
    return 'usage: `/quote [user:@User] [number:quote number] [list:true|false]` -- I retrieve a random quote (or from the specified user).\n if you specify `list:true` I will DM you a full list of quotes for that user (or quote counts for all users if no user is specified) \n if you specify `number`, I will return that exact quote, rather than a random one.';
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Retrieve a random or specific quote, or list saved quotes')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user to retrieve quotes for').setRequired(false),
        )
        .addIntegerOption((option) =>
          option
            .setName('number')
            .setDescription('Exact quote number to retrieve for the user')
            .setMinValue(1)
            .setRequired(false),
        )
        .addBooleanOption((option) =>
          option
            .setName('list')
            .setDescription('DM a full list of quotes for the user, or quote counts for all users')
            .setRequired(false),
        )
        .toJSON(),
    ];
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      return;
    }

    const targetUser = interaction.options.getUser('user');
    const quoteNumber = interaction.options.getInteger('number');
    const listRequested = interaction.options.getBoolean('list') ?? false;

    if (listRequested && !targetUser) {
      await this.listAllCounts(interaction);
      return;
    }

    if (targetUser) {
      const member = await this.sb.getMember(interaction.guild.id, targetUser.id);
      if (!member) {
        await interaction.reply({
          content: 'Could not find that member in this server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (listRequested) {
        await this.listAllUserQuotes(interaction, member);
        return;
      }

      if (quoteNumber !== null) {
        await this.getUserQuote(interaction, member, quoteNumber);
        return;
      }

      await this.getRandomMemberQuote(interaction, member);
      return;
    }

    return await this.getRandomQuote(interaction);
  }

  private async listAllCounts(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      return;
    }
    const guildId = interaction.guild.id;

    const results: { cnt: string; userDiscordUserId: string }[] = await this.sb.dbConnection
      .getRepository(Quote)
      .createQueryBuilder()
      .select('COUNT(1) as cnt, userDiscordUserId')
      .where('guildId = :guildId', { guildId })
      .groupBy('userDiscordUserId')
      .getRawMany();

    const allMembers = await Promise.all(results.map((result) => this.sb.getMember(guildId, result.userDiscordUserId)));
    let outputString = '';
    allMembers.forEach((member) => {
      if (member) {
        const foundResult = results.find((result) => result.userDiscordUserId === member.user.id);
        if (foundResult) {
          outputString += `${member.displayName} (${member.user.username}): ${foundResult.cnt} saved quotes\n`;
        }
      }
    });
    if (outputString.length) {
      const dmChannel = await interaction.user.createDM();
      await dmChannel.send(outputString);
      await interaction.reply({ content: 'Sent quote counts to your DMs.', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: 'No quotes saved in this server yet.', flags: MessageFlags.Ephemeral });
    }
  }

  private async listAllUserQuotes(
    interaction: ChatInputCommandInteraction,
    mentionedMember: GuildMember,
  ): Promise<void> {
    if (!interaction.guild) {
      return;
    }

    const dmChannel = await interaction.user.createDM();
    const allQuotesForMentioned = await this.sb.dbConnection.getRepository(Quote).find({
      relations: ['user'],
      where: { user: { discordUserId: mentionedMember.user.id }, guildId: interaction.guild.id },
    });
    if (allQuotesForMentioned && allQuotesForMentioned.length) {
      let finalMessage = mentionedMember.displayName + '\n----------------------------\n';
      allQuotesForMentioned.forEach((quote, index) => {
        finalMessage += `${index + 1} - ${quote.quoteText}\n`;
      });
      await dmChannel.send(finalMessage + '----------------------------\n');
      await interaction.reply({
        content: `Sent ${mentionedMember.displayName}'s quotes to your DMs.`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply(`${mentionedMember.displayName} has no saved quotes`);
    }
  }

  private async getUserQuote(
    interaction: ChatInputCommandInteraction,
    member: GuildMember,
    quoteNumber: number,
  ): Promise<void> {
    if (!interaction.guild) {
      return;
    }
    const guildId = interaction.guild.id;

    const userQuotes = await this.sb.dbConnection.getRepository(Quote).find({
      order: { id: 1 },
      relations: ['user'],
      where: { user: { discordUserId: member.id }, guildId },
    });

    if (!userQuotes.length) {
      await interaction.reply(`${member.displayName} has no saved quotes`);
      return;
    }

    if (!quoteNumber) {
      quoteNumber = Math.floor(Math.random() * userQuotes.length) + 1;
    }

    if (quoteNumber > userQuotes.length) {
      await interaction.reply(`${member.displayName} only has ${userQuotes.length} saved quotes`);
      return;
    }

    const quote = userQuotes[quoteNumber - 1];
    await interaction.reply(
      `${member.displayName} said: "${quote.quoteText}" (quote #${quoteNumber}) of ${userQuotes.length}`,
    );
  }

  private async getRandomMemberQuote(interaction: ChatInputCommandInteraction, member: GuildMember) {
    if (!interaction.guild) {
      return;
    }
    const guildId = interaction.guild.id;
    const userQuoteCount = await this.sb.dbConnection.getRepository(Quote).count({
      relations: ['user'],
      where: { user: { discordUserId: member.id }, guildId },
    });
    const index = Math.floor(Math.random() * userQuoteCount);
    await this.getUserQuote(interaction, member, index);
  }

  private async getRandomQuote(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return;
    }
    const guildId = interaction.guild.id;
    const randomQuotes = await this.sb.dbConnection.getRepository(Quote).find({ where: { guildId } });
    if (randomQuotes && randomQuotes.length) {
      const randomQuote = randomQuotes[Math.floor(Math.random() * randomQuotes.length)];
      const member = await this.sb.getMember(guildId, randomQuote.user.discordUserId);
      if (member) {
        await this.getRandomMemberQuote(interaction, member);
        return;
      }
    }
    await interaction.reply('No quotes found.');
  }
}
