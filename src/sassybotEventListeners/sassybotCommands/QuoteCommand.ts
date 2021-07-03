import { GuildMember, Message } from 'discord.js';
import Quote from '../../entity/Quote';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class QuoteCommand extends SassybotCommand {
  public readonly commands = ['quote', 'quotes'];

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} quote [list|int: quote number] {@User}` -- I retrieve a random quote from the tagged users.\n if you specify "list" I will pm you a full list of quotes \n if you specify a number, I will return that exact quote, rather than a random one.';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (!message.guild || !message.member) {
      return;
    }

    if (params.args.includes('list all') && !params.mentions) {
      await this.listAllCounts(message);
      return;
    }

    if (params.mentions) {
      const members = params.mentions.members;
      if (members) {
        if (params.args.includes('list') && members.size > 0) {
          await members.reduce(async (previousPromise, member) => {
            await previousPromise;
            return this.listAllUserQuotes(message, member);
          }, Promise.resolve());
          return;
        }

        const paramParts = params.args.split(' ');
        if (paramParts.length) {
          const quoteNumbersRequested: number[] = paramParts
            .filter(RegExp.prototype.test.bind(/^\+?(0|[1-9]\d*)$/))
            .map(parseInt);
          if (quoteNumbersRequested.length && members && members.size === 1) {
            const member = members.first();
            if (member) {
              await quoteNumbersRequested.reduce(async (previousPromise, quoteNumber) => {
                await previousPromise;
                return this.getUserQuote(message, member, quoteNumber);
              }, Promise.resolve());
            }
            return;
          }
        }

        await members.reduce(async (previousPromise, member) => {
          await previousPromise;
          return this.getRandomMemberQuote(message, member);
        }, Promise.resolve());
        return;
      }
    }
    return await this.getRandomQuote(message);
  }

  private async listAllCounts(message: Message): Promise<void> {
    if (!message.guild) {
      return;
    }
    const guildId = message.guild.id;

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
      const dmChannel = await message.author.createDM();
      await dmChannel.send(outputString);
    }
  }

  private async listAllUserQuotes(message: Message, mentionedMember: GuildMember): Promise<void> {
    if (!message.guild) {
      return;
    }

    const dmChannel = await message.author.createDM();
    const allQuotesForMentioned = await this.sb.dbConnection.getRepository(Quote).find({
      relations: ['user'],
      where: { user: { discordUserId: mentionedMember.user.id }, guildId: message.guild.id },
    });
    if (allQuotesForMentioned && allQuotesForMentioned.length) {
      let finalMessage = mentionedMember.displayName + '\n----------------------------\n';
      allQuotesForMentioned.forEach((quote, index) => {
        finalMessage += `${index + 1} - ${quote.quoteText}\n`;
      });
      await dmChannel.send(finalMessage + '----------------------------\n');
    }
  }

  private async getUserQuote(message: Message, member: GuildMember, quoteNumber: number): Promise<void> {
    if (!message.guild) {
      return;
    }
    const guildId = message.guild.id;

    const userQuotes = await this.sb.dbConnection.getRepository(Quote).find({
      order: { id: 1 },
      relations: ['user'],
      where: { user: { discordUserId: member.id }, guildId },
    });

    if (!userQuotes.length) {
      await message.channel.send(`${member.displayName} has no saved quotes`);
      return;
    }

    if (!quoteNumber) {
      quoteNumber = Math.floor(Math.random() * userQuotes.length) + 1;
    }

    if (quoteNumber > userQuotes.length) {
      await message.channel.send(`${member.displayName} only has ${userQuotes.length} saved quotes`);
      return;
    }

    const quote = userQuotes[quoteNumber - 1];

    await message.channel.send(
      `${member.displayName} said: "${quote.quoteText}" (quote #${quoteNumber}) of ${userQuotes.length}`,
      {
        split: true,
      },
    );
  }

  private async getRandomMemberQuote(message: Message, member: GuildMember) {
    if (!message.guild) {
      return;
    }
    const guildId = message.guild.id;
    const userQuoteCount = await this.sb.dbConnection.getRepository(Quote).count({
      relations: ['user'],
      where: { user: { discordUserId: member.id }, guildId },
    });
    const index = Math.floor(Math.random() * userQuoteCount);
    await this.getUserQuote(message, member, index);
  }

  private async getRandomQuote(message: Message) {
    if (!message.guild) {
      return;
    }
    const guildId = message.guild.id;
    const randomQuotes = await this.sb.dbConnection.getRepository(Quote).find({ where: { guildId } });
    if (randomQuotes) {
      const randomQuote = randomQuotes[Math.floor(Math.random() * randomQuotes.length)];
      const member = await this.sb.getMember(guildId, randomQuote.user.discordUserId);
      if (member) {
        await this.getRandomMemberQuote(message, member);
      }
    }
  }
}
