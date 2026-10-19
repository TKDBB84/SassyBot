import {
  ApplicationCommandType,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  GuildMember,
  InteractionContextType,
  type MessageContextMenuCommandInteraction,
  MessageFlags,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import Quote from '../../entity/Quote';
import SassybotCommand from './SassybotCommand';

export default class QuoteCommand extends SassybotCommand {
  public static readonly SAVE_QUOTE_CONTEXT_MENU_NAME = 'Save Quote';

  private static chunkText(text: string, maxLength = 1950): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    let current = '';
    for (const line of lines) {
      const candidate = current ? `${current}\n${line}` : line;
      if (candidate.length > maxLength) {
        if (current) {
          chunks.push(current);
          current = line.slice(0, maxLength);
        } else {
          chunks.push(line.slice(0, maxLength));
          current = '';
        }
      } else {
        current = candidate;
      }
    }
    if (current) {
      chunks.push(current);
    }
    return chunks;
  }

  public getHelpText(): string {
    return (
      'usage:\n' +
      '- `/quote random [user:@User]` -- Retrieve a random quote (or from the specified user)\n' +
      '- `/quote get user:@User number:<quote number>` -- Retrieve that exact quote number for the user\n' +
      '- `/quote list [user:@User]` -- Display a full list of quotes for that user (or quote counts for all users if no user is specified)\n' +
      '- Right-click any message -> **Apps -> Save Quote** to save a message as a quote'
    );
  }

  public override getSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [
      new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Retrieve a random or specific quote, or list saved quotes')
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((subcommand) =>
          subcommand
            .setName('random')
            .setDescription('Retrieve a random quote from the server or a specific user')
            .addUserOption((option) =>
              option.setName('user').setDescription('The user to retrieve a random quote for').setRequired(false),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('get')
            .setDescription('Retrieve a specific quote by number for a user')
            .addUserOption((option) =>
              option.setName('user').setDescription('The user to retrieve the quote for').setRequired(true),
            )
            .addIntegerOption((option) =>
              option
                .setName('number')
                .setDescription('Exact quote number to retrieve for the user')
                .setMinValue(1)
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('list')
            .setDescription('Display a full list of quotes for a user, or quote counts for all users')
            .addUserOption((option) =>
              option.setName('user').setDescription('The user to list quotes for').setRequired(false),
            ),
        )
        .toJSON(),
    ];
  }

  public override getContextMenuCommands(): RESTPostAPIContextMenuApplicationCommandsJSONBody[] {
    return [
      new ContextMenuCommandBuilder()
        .setName(QuoteCommand.SAVE_QUOTE_CONTEXT_MENU_NAME)
        .setType(ApplicationCommandType.Message)
        .setContexts(InteractionContextType.Guild)
        .toJSON(),
    ];
  }

  public override async contextMenuListener({
    interaction,
  }: {
    interaction: MessageContextMenuCommandInteraction;
  }): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetMessage = interaction.targetMessage;
    if (targetMessage.author.bot) {
      await interaction.reply({
        content: 'Cannot quote bot messages.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const quoteText = targetMessage.cleanContent.trim();
    if (!quoteText) {
      await interaction.reply({
        content: 'That message has no text content to quote.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();
    const quoteRepo = this.sb.dbConnection.getRepository(Quote);
    const alreadyQuoted = await quoteRepo.findOne({ where: { messageId: targetMessage.id } });
    if (alreadyQuoted) {
      await interaction.editReply('That message has already been quoted.');
      return;
    }

    const sbUser = await this.sb.maybeCreateSBUser(targetMessage.author.id);
    const sbQuote = new Quote();
    sbQuote.user = sbUser;
    sbQuote.quoteText = quoteText;
    sbQuote.channelId = targetMessage.channelId;
    sbQuote.guildId = interaction.guild.id;
    sbQuote.messageId = targetMessage.id;
    const savedQuote = await quoteRepo.save(sbQuote, { reload: true });
    const quotedMember = await this.sb
      .getMember(savedQuote.guildId, savedQuote.user.discordUserId)
      .catch(() => undefined);
    const displayName = quotedMember?.displayName ?? targetMessage.author.displayName;
    await interaction.editReply(`I've noted that ${displayName} said: "${savedQuote.quoteText}"`);
  }

  protected async listener({ interaction }: { interaction: ChatInputCommandInteraction }): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');

    if (subcommand === 'list') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!targetUser) {
        await this.listAllCounts(interaction);
        return;
      }
      const member = await this.sb.getMember(interaction.guild.id, targetUser.id);
      if (!member) {
        await interaction.editReply('Could not find that member in this server.');
        return;
      }
      await this.listAllUserQuotes(interaction, member);
      return;
    }

    await interaction.deferReply();

    if (subcommand === 'get') {
      const user = interaction.options.getUser('user', true);
      const quoteNumber = interaction.options.getInteger('number', true);
      const member = await this.sb.getMember(interaction.guild.id, user.id);
      if (!member) {
        await interaction.editReply('Could not find that member in this server.');
        return;
      }
      await this.getUserQuote(interaction, member, quoteNumber);
      return;
    }

    // subcommand === 'random'
    if (targetUser) {
      const member = await this.sb.getMember(interaction.guild.id, targetUser.id);
      if (!member) {
        await interaction.editReply('Could not find that member in this server.');
        return;
      }
      await this.getUserQuote(interaction, member);
      return;
    }

    await this.getRandomQuote(interaction);
  }

  private async sendEphemeralChunks(interaction: ChatInputCommandInteraction, text: string): Promise<void> {
    const chunks = QuoteCommand.chunkText(text);
    await interaction.editReply(chunks[0] ?? 'No quotes found.');
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ content: chunks[i], flags: MessageFlags.Ephemeral });
    }
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

    const allMembers = await Promise.all(
      results.map((result) => this.sb.getMember(guildId, result.userDiscordUserId).catch(() => undefined)),
    );
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
      await this.sendEphemeralChunks(interaction, outputString.trimEnd());
    } else {
      await interaction.editReply('No quotes saved in this server yet.');
    }
  }

  private async listAllUserQuotes(
    interaction: ChatInputCommandInteraction,
    mentionedMember: GuildMember,
  ): Promise<void> {
    if (!interaction.guild) {
      return;
    }

    const allQuotesForMentioned = await this.sb.dbConnection.getRepository(Quote).find({
      order: { id: 1 },
      relations: ['user'],
      where: { user: { discordUserId: mentionedMember.user.id }, guildId: interaction.guild.id },
    });
    if (allQuotesForMentioned.length) {
      let finalMessage = mentionedMember.displayName + '\n----------------------------\n';
      allQuotesForMentioned.forEach((quote, index) => {
        finalMessage += `${index + 1} - ${quote.quoteText}\n`;
      });
      finalMessage += '----------------------------';
      await this.sendEphemeralChunks(interaction, finalMessage);
    } else {
      await interaction.editReply(`${mentionedMember.displayName} has no saved quotes`);
    }
  }

  private async getUserQuote(
    interaction: ChatInputCommandInteraction,
    member: GuildMember,
    quoteNumber?: number,
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
      await interaction.editReply(`${member.displayName} has no saved quotes`);
      return;
    }

    const selectedNumber = quoteNumber ?? Math.floor(Math.random() * userQuotes.length) + 1;

    if (selectedNumber > userQuotes.length) {
      await interaction.editReply(`${member.displayName} only has ${userQuotes.length} saved quotes`);
      return;
    }

    const quote = userQuotes[selectedNumber - 1];
    await interaction.editReply(
      `${member.displayName} said: "${quote.quoteText}" (quote #${selectedNumber}) of ${userQuotes.length}`,
    );
  }

  private async getRandomQuote(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return;
    }
    const guildId = interaction.guild.id;
    const allQuotes = await this.sb.dbConnection.getRepository(Quote).find({
      order: { id: 1 },
      relations: ['user'],
      where: { guildId },
    });
    if (allQuotes.length) {
      const randomQuote = allQuotes[Math.floor(Math.random() * allQuotes.length)];
      const authorId = randomQuote.user?.discordUserId;
      if (authorId) {
        const userQuotes = allQuotes.filter((q) => q.user?.discordUserId === authorId);
        const quoteIndex = userQuotes.findIndex((q) => q.id === randomQuote.id) + 1;
        const member = await this.sb.getMember(guildId, authorId).catch(() => undefined);
        const displayName = member?.displayName ?? 'Unknown Member';
        await interaction.editReply(
          `${displayName} said: "${randomQuote.quoteText}" (quote #${quoteIndex || 1}) of ${userQuotes.length}`,
        );
        return;
      }
    }
    await interaction.editReply('No quotes found.');
  }
}
