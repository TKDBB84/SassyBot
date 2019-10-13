import { GuildMember, Message } from 'discord.js';
import Quote from '../../entity/Quote';
import SbUser from '../../entity/SbUser';
import { ISassybotCommandParams } from '../../Sassybot';
import SassybotCommand from './SassybotCommand';

export default class QuoteCommand extends SassybotCommand {
  public readonly command = 'quote';

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} quote [list|int: quote number] {@User}` -- I retrieve a random quote from the tagged users.\n if you specify "list" I will pm you a full list of quotes \n if you specify a number, I will return that exact quote, rather than a random one.';
  }

  protected async listener({ message, params }: { message: Message; params: ISassybotCommandParams }): Promise<void> {
    if (params.args.includes('list all') && !params.mentions) {
      await this.listAllCounts(message);
      return;
    }

    if (params.mentions) {
      const members = params.mentions.members.array();
      if (params.args.includes('list') && members.length > 0) {
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
        if (quoteNumbersRequested.length && members.length === 1) {
          await quoteNumbersRequested.reduce(async (previousPromise, quoteNumber) => {
            await previousPromise;
            return this.getUserQuote(message, members[0], quoteNumber);
          }, Promise.resolve());
          return;
        }
      }

      await members.reduce(async (previousPromise, member) => {
        await previousPromise;
        return this.getRandomMemberQuote(message, member);
      }, Promise.resolve());
      return;
    }
    return await this.getRandomQuote(message);
  }

  private async listAllCounts(message: Message): Promise<void> {
    const results: Array<{ cnt: string; discordUserId: string }> = await this.sb.dbConnection
      .getRepository(Quote)
      .createQueryBuilder('quote')
      .innerJoinAndSelect(SbUser, 'user')
      .select('COUNT(1) as cnt, user.discordUserId')
      .where('guildId = :guildId', { guildId: message.guild.id })
      .groupBy('quote.user')
      .getRawMany();

    const allMembers = await Promise.all(
      results.map((result) => this.sb.getMember(message.guild.id, result.discordUserId)),
    );
    let outputString = '';
    allMembers.forEach((member) => {
      if (member) {
        const foundResult = results.find((result) => result.discordUserId === member.user.id);
        if (foundResult) {
          outputString += `${member.displayName} (${member.user.username}): ${foundResult.cnt} saved quotes\n`;
        }
      }
    });
    if (outputString.length) {
      const dmChannel = await message.author.createDM();
      dmChannel.send(outputString);
    }
  }

  private async listAllUserQuotes(message: Message, mentionedMember: GuildMember): Promise<void> {
    const dmChannel = await message.author.createDM();
    const allQuotesForMentioned = await this.sb.dbConnection
      .getRepository(Quote)
      .createQueryBuilder('quote')
      .innerJoinAndSelect(SbUser, 'user')
      .where({ 'quote.user': mentionedMember.user.id })
      .getMany();

    if (allQuotesForMentioned && allQuotesForMentioned.length) {
      let finalMessage = mentionedMember.displayName + '\n----------------------------\n';
      allQuotesForMentioned.forEach((quote, index) => {
        finalMessage += `${index + 1} - ${quote.quoteText}\n`;
      });
      dmChannel.send(finalMessage + '----------------------------\n');
    }
  }

  private async getUserQuote(message: Message, member: GuildMember, quoteNumber: number): Promise<void> {
    const userQuotes = await this.sb.dbConnection
      .getRepository(Quote)
      .createQueryBuilder('quote')
      .innerJoinAndSelect(SbUser, 'user')
      .where({ 'user.discordUserId': member.user.id })
      .orderBy('quote.id')
      .getMany();

    if (!userQuotes.length) {
      message.channel.send(`${member.displayName} has no saved quotes`);
      return;
    }

    if (!quoteNumber) {
      quoteNumber = Math.floor(Math.random() * userQuotes.length) + 1;
    }

    if (quoteNumber > userQuotes.length) {
      message.channel.send(`${member.displayName} only has ${userQuotes.length} saved quotes`);
      return;
    }

    const quote = userQuotes[quoteNumber - 1];

    message.channel.send(
      `${member.displayName} said: "${quote.quoteText}" (quote #${quoteNumber})\n\n and has ${
        userQuotes.length - 1 === 0 ? 'No' : userQuotes.length - 1
      } other quotes saved`,
      {
        split: true,
      },
    );
  }

  private async getRandomMemberQuote(message: Message, member: GuildMember) {
    const userQuoteCount = await this.sb.dbConnection.getRepository(Quote).count();
    const index = Math.floor(Math.random() * userQuoteCount);
    await this.getUserQuote(message, member, index);
  }

  private async getRandomQuote(message: Message) {
    const randomQuote = await this.sb.dbConnection
      .getRepository(Quote)
      .createQueryBuilder()
      .innerJoinAndSelect(SbUser, 'user')
      .addOrderBy('RAND()')
      .limit(1)
      .getOne();
    if (randomQuote) {
      const member = await this.sb.getMember(message.guild.id, randomQuote.user.discordUserId);
      if (member) {
        await this.getRandomMemberQuote(message, member);
      }
    }
  }
}
