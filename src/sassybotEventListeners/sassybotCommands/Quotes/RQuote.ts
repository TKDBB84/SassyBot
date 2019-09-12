import { Message, User } from 'discord.js';
import Quote from '../../../entity/Quote';
import { ISassybotCommandParams } from '../../../Sassybot';
import SassybotCommand from '../SassybotCommand';

export default class Echo extends SassybotCommand {
  public readonly command = 'rquote';

  public getHelpText(): string {
    return 'usage: `!{sassybot|sb} rquote [list|int: quote number] {@User}` -- I retrieve a random quote from the tagged users.\n if you specify "list" I will pm you a full list of quotes \n if you specify a number, I will return that exact quote, rather than a random one.';
  }

  protected async listener(message: Message, params: ISassybotCommandParams): Promise<void> {
    if (params.args.includes('list all') && !params.mentions) {
      await this.listAllCounts(message);
    }

    if (params.args.includes('list') && params.mentions) {
      const users = params.mentions.users.array();
      await users.reduce(async (previousPromise, user) => {
        await previousPromise;
        return this.listAllUserQuotes(message, user);
      }, Promise.resolve());
    }
  }

  private async listAllCounts(message: Message): Promise<void> {
    const results = await this.sb.dbConnection
      .getRepository<Quote>(Quote)
      .createQueryBuilder('quote')
      .select('COUNT(1)', 'cnt')
      .where('guildId = :guildId', { guildId: message.guild.id })
      .groupBy('quote.user')
      .getMany();
    // SELECT COUNT(1) as cnt, user_id FROM user_quotes WHERE guild_id = ? GROUP BY user_id
    let outputString = '';
    for (let j = 0, jMax = results.length; j < jMax; j++) {
      const member = message.guild.members.get(results[j].user.discordUserId);
      if (member) {
        outputString += member.displayName + '(' + member.user.username + '): ' + results[j] + ' saved quotes' + '\n';
      }
    }
  }

  private async listAllUserQuotes(message: Message, user: User): Promise<void> {
    const foo = 'bar';
    console.log(foo);
  }
}
/*
const parts = message.content.match(/!(?:sassybot|sb)\srquote\s(?:@\w+)?(\d+|list)\s?(?:@\w+)?(all)?/i);
  const quotedMember = message.mentions.members.first();
  if (parts && parts[0] === '!sb rquote list all') {
    const countRows: IQuoteCountRow[] = getQuoteCounts.all([message.guild.id]);
    let outputString = '';
    for (let j = 0, jMax = countRows.length; j < jMax; j++) {
      const member = message.guild.members.get(countRows[j].user_id);
      if (member) {
        outputString +=
          member.displayName + '(' + member.user.username + '): ' + countRows[j].cnt + ' saved quotes' + '\n';
      }
    }
    await sassybotRespond(message, outputString);
    return;
  }
  if (hasSingleMention(message)) {
    if (!parts) {
      const rows: IQuoteRow[] = getQuotesByUser.all(message.guild.id, quotedMember.id);
      if (rows.length > 0) {
        const selectedQuoted = Math.floor(Math.random() * rows.length);
        const row = rows[selectedQuoted];
        const quote = {
          content: row.quote_text ? row.quote_text : '',
          count: rows.length,
          number: selectedQuoted + 1,
        };
        if (!row.quote_text || row.quote_text === '') {
          const channel = client.channels.get(row.channel_id);
          if (channel instanceof TextChannel) {
            const recalledMessage = await channel.fetchMessage(row.message_id);
            const content = recalledMessage.cleanContent;
            updateMessageText.run([content, row.message_id]);
            quote.content = content;
            await sassybotRespond(
              message,
              `${quotedMember.displayName} said: "${quote.content}" (quote #${quote.number})\n\n and has ${
                quote.count - 1 === 0 ? 'No' : quote.count - 1
              } other quotes saved`,
            );
          }
        } else {
          await sassybotRespond(
            message,
            `${quotedMember.displayName} said: "${quote.content}" (quote #${quote.number})\n\n and has ${
              quote.count - 1 === 0 ? 'No' : quote.count - 1
            } other quotes saved`,
          );
        }
      }
    } else if (parts.length >= 2 && parts[1].toLowerCase() === 'list') {
      const target = message.author;
      const rows: IQuoteRow[] = getQuotesByUser.all([message.guild.id, quotedMember.id]);

      const builtMessages = [];
      const fetches = [];
      let finalMessage = quotedMember.displayName + '\n----------------------------\n';
      for (let i = 0, iMax = rows.length; i < iMax; i++) {
        const row = rows[i];
        if (!row.quote_text || row.quote_text === '') {
          const channel = client.channels.get(row.channel_id);
          if (channel instanceof TextChannel) {
            fetches.push(channel.fetchMessage(row.message_id));
          }
        } else {
          builtMessages[i] = row.quote_text;
        }
      }
      if (fetches.length > 0) {
        const results = await Promise.all(fetches);
        for (let k = 0, kMax = results.length; k < kMax; k++) {
          const content = results[k].cleanContent;
          updateMessageText.run([content, results[k].id]);
        }
        const quoteRows: IQuoteRow[] = getQuotesByUser.all([message.guild.id, quotedMember.id]);
        for (let i = 0, iMax = quoteRows.length; i < iMax; i++) {
          finalMessage += i + 1 + ': ' + quoteRows[i].quote_text + '\n';
        }
        target.send(finalMessage + '----------------------------');
      } else {
        for (let j = 0, jMax = builtMessages.length; j < jMax; j++) {
          finalMessage += j + 1 + ': ' + builtMessages[j] + '\n';
        }
        target.send(finalMessage + '----------------------------');
      }
    } else if (parts.length >= 2 && isNormalInteger(parts[1])) {
      const rows: IQuoteRow[] = getQuotesByUser.all([message.guild.id, quotedMember.id]);
      if (rows.length > 0) {
        const selectedQuoted = Number(parts[1]);
        const row = rows[selectedQuoted - 1];
        const quote = {
          content: row.quote_text ? row.quote_text : '',
          count: rows.length,
          number: selectedQuoted,
        };
        if (!row.quote_text || row.quote_text === '') {
          const channel = client.channels.get(row.channel_id);
          if (channel instanceof TextChannel) {
            const recalledMessage = await channel.fetchMessage(row.message_id);
            const content = recalledMessage.cleanContent;
            updateMessageText.run([content, row.message_id]);
            quote.content = content;
            await sassybotRespond(
              message,
              `${quotedMember.displayName} said: "${quote.content}" (quote #${quote.number})\n\n and has ${
                quote.count - 1 === 0 ? 'No' : quote.count - 1
              } other quotes saved`,
            );
          }
        } else {
          await sassybotRespond(
            message,
            `${quotedMember.displayName} said: "${quote.content}" (quote #${quote.number})\n\n and has ${
              quote.count - 1 === 0 ? 'No' : quote.count - 1
            } other quotes saved`,
          );
        }
      }
    }
  } else {
    await sassybotRespond(message, 'You must specify whose quote you want to retrieve');
  }
 */
