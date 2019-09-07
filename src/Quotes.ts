import { Statement } from 'better-sqlite3';
import { Channel, Collection, Message, MessageOptions, MessageReaction, Snowflake, TextChannel } from 'discord.js';
import * as Discord from 'discord.js';
import { ISassyBotImport, SassyBotCommand } from './sassybot';

interface IQuoteRow {
  guild_id: string;
  user_id: string;
  channel_id: string;
  message_id: string;
  timestamp: string;
  quote_text: string;
}
interface IQuoteCountRow {
  cnt: string;
  user_id: string;
}

import SassyDb from './SassyDb';
const db = new SassyDb();
const client = new Discord.Client();

const sassybotRespond = (message: Message, text: string): Promise<Message | Message[]> => {
  const options: MessageOptions = {
    disableEveryone: true,
    split: true,
  };
  return message.channel.send(text, options);
};

db.connection.exec(
  'CREATE TABLE IF NOT EXISTS user_quotes (guild_id TEXT, user_id TEXT, channel_id TEXT, message_id TEXT, timestamp INTEGER, quote_text TEXT);',
);
const addQuote: Statement = db.connection.prepare(
  "INSERT INTO user_quotes (guild_id, user_id, channel_id, message_id, timestamp, quote_text) VALUES (?,?,?,?,strftime('%s','now'),?);",
);
const getQuotesByUser: Statement = db.connection.prepare(
  'SELECT * FROM user_quotes WHERE guild_id = ? AND user_id = ? ORDER BY message_id;',
);
const updateMessageText: Statement = db.connection.prepare(
  'UPDATE user_quotes SET quote_text = ? WHERE message_id = ?;',
);

const getQuoteCounts: Statement = db.connection.prepare(
  'SELECT COUNT(1) as cnt, user_id FROM user_quotes WHERE guild_id = ? GROUP BY user_id',
);

const hasSingleMention: (message: Message) => boolean = (message: Message): boolean => {
  return message.mentions && message.mentions.members && message.mentions.members.array().length === 1;
};

const hasReaction: (message: Message) => boolean = (message: Message): boolean => {
  return message.reactions && message.reactions.array().length > 0;
};

const hasQuoteReaction: (message: Message) => boolean = (message: Message): boolean => {
  const reactions: Collection<Snowflake, MessageReaction> = message.reactions;
  return !!reactions.find((reaction: MessageReaction): boolean => reaction.emoji.name.includes('quote'));
};

const isNormalInteger: (str: string) => boolean = (str: string): boolean => /^\+?(0|[1-9]\d*)$/.test(str);

const quoteFunction: SassyBotCommand = async (message) => {
  if (hasSingleMention(message)) {
    /** @var GuildMember quotedMember */
    const quotedMember = message.mentions.members.first();
    /** @var TextChannel activeChannel */
    const activeChannel = message.channel;
    const messages = await activeChannel.fetchMessages({
      before: message.id,
      limit: 50,
    });
    const messagesWithReactions: Message[] = messages
      .filter((item) => item.author.id === quotedMember.id && hasReaction(item) && hasQuoteReaction(item))
      .array();

    let foundOne = false;
    for (let i = 0, iMax = messagesWithReactions.length; i < iMax; i++) {
      const reactions: MessageReaction[] = messagesWithReactions[i].reactions.array();
      for (let k = 0, kMax = reactions.length; k < kMax; k++) {
        const reaction = reactions[k];
        if (!foundOne) {
          const users = await reaction.fetchUsers();
          if (users.get(message.author.id) && !foundOne) {
            if (reaction.message.cleanContent !== '') {
              addQuote.run([
                message.guild.id,
                reaction.message.author.id,
                activeChannel.id,
                reaction.message.id,
                reaction.message.cleanContent,
              ]);
              await sassybotRespond(
                message,
                "I've noted that " + quotedMember.displayName + ' said: "' + reaction.message.cleanContent + '"',
              );
              foundOne = true;
            }
          }
        }
      }
    }
  }
};

const rQuoteFunction: SassyBotCommand = async (message: Message) => {
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
};

const quoteExport: ISassyBotImport = {
  functions: {
    quote: quoteFunction,
    rquote: rQuoteFunction,
  },
  help: {
    quote:
      "usage: `!{sassybot|sb} quote {@User}` -- This command causes me to search through this room's chat history (last 50 messages) for a message sent by the specified @User, which as a :quote: reaction from you, and record that message.",
    rquote:
      'usage: `!{sassybot|sb} rquote [list|int: quote number] {@User}` -- I retrieve a random quote from the tagged users.\n if you specify "list" I will pm you a full list of quotes \n if you specify a number, I will return that exact quote, rather than a random one.',
  },
};

export default quoteExport;
