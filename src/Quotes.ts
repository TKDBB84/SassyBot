import { Statement } from 'better-sqlite3';
import {
  Collection,
  GuildMember,
  Message,
  MessageOptions,
  MessageReaction,
  Snowflake,
  TextChannel,
  User
} from 'discord.js';
import { SassyBotCommand, SassyBotImport } from './sassybot';
import * as Discord from 'discord.js';

type QuoteRow = {
  guild_id: string;
  user_id: string;
  channel_id: string;
  message_id: string;
  timestamp: string;
  quote_text: string;
};
type QuoteCountRow = { cnt: string; user_id: string };

import SassyDb from './SassyDb';
const db = new SassyDb();
const client = new Discord.Client();

const sassybotRespond: (message: Message, reply: string) => void = (
  message: Message,
  text: string
): void => {
  const options: MessageOptions = {
    disableEveryone: true,
    split: true
  };
  message.channel.send(text, options).catch(console.error);
};

db.connection.exec(
  'CREATE TABLE IF NOT EXISTS user_quotes (guild_id TEXT, user_id TEXT, channel_id TEXT, message_id TEXT, timestamp INTEGER, quote_text TEXT);'
);
const addQuote: Statement = db.connection.prepare(
  "INSERT INTO user_quotes (guild_id, user_id, channel_id, message_id, timestamp, quote_text) VALUES (?,?,?,?,strftime('%s','now'),?);"
);
const getQuotesByUser: Statement = db.connection.prepare(
  'SELECT * FROM user_quotes WHERE guild_id = ? AND user_id = ? ORDER BY message_id;'
);
const updateMessageText: Statement = db.connection.prepare(
  'UPDATE user_quotes SET quote_text = ? WHERE message_id = ?;'
);

const getQuoteCounts: Statement = db.connection.prepare(
  'SELECT COUNT(1) as cnt, user_id FROM user_quotes WHERE guild_id = ? GROUP BY user_id'
);

const hasSingleMention: (message: Message) => boolean = (
  message: Message
): boolean => {
  return (
    message.mentions &&
    message.mentions.members &&
    message.mentions.members.array().length === 1
  );
};

const hasReaction: (message: Message) => boolean = (
  message: Message
): boolean => {
  return message.reactions && message.reactions.array().length > 0;
};

const hasQuoteReaction: (message: Message) => boolean = (
  message: Message
): boolean => {
  const reactions: Collection<Snowflake, MessageReaction> = message.reactions;
  return !!reactions.find((reaction: MessageReaction): boolean =>
    reaction.emoji.name.includes('quote')
  );
};

const isNormalInteger: (str: string) => boolean = (str: string): boolean =>
  /^\+?(0|[1-9]\d*)$/.test(str);

const quoteFunction: SassyBotCommand = (message: Message): void => {
  if (hasSingleMention(message)) {
    /** @var GuildMember quotedMember */
    const quotedMember = message.mentions.members.first();
    /** @var TextChannel activeChannel */
    const activeChannel = message.channel;
    activeChannel
      .fetchMessages({
        limit: 50,
        before: message.id
      })
      .then((messages: Collection<string, Message>) => {
        const messagesWithReactions: Message[] = messages
          .filter(
            (item) =>
              item.author.id === quotedMember.id &&
              hasReaction(item) &&
              hasQuoteReaction(item)
          )
          .array();

        let foundOne = false;
        for (let i = 0, iMax = messagesWithReactions.length; i < iMax; i++) {
          const reactions: MessageReaction[] = messagesWithReactions[
            i
          ].reactions.array();
          for (let k = 0, kMax = reactions.length; k < kMax; k++) {
            const reaction = reactions[k];
            if (!foundOne) {
              reaction
                .fetchUsers()
                .then((users: Collection<Snowflake, User>) => {
                  if (users.get(message.author.id) && !foundOne) {
                    if (reaction.message.cleanContent !== '') {
                      addQuote.run([
                        message.guild.id,
                        reaction.message.author.id,
                        activeChannel.id,
                        reaction.message.id,
                        reaction.message.cleanContent
                      ]);
                      sassybotRespond(
                        message,
                        "I've noted that " +
                          quotedMember.displayName +
                          ' said: "' +
                          reaction.message.cleanContent +
                          '"'
                      );
                      foundOne = true;
                    }
                  }
                });
            }
          }
        }
      });
  }
};

const rQuoteFunction: SassyBotCommand = (message: Message): void => {
  let parts = message.content.match(
    /!(?:sassybot|sb)\srquote\s(?:@\w+)?(\d+|list)\s?(?:@\w+)?(all)?/i
  );
  let quotedMember = message.mentions.members.first();
  if (parts && parts[0] === '!sb rquote list all') {
    const countRows: QuoteCountRow[] = getQuoteCounts.all([message.guild.id]);
    let outputString = '';
    for (let j = 0, jMax = countRows.length; j < jMax; j++) {
      const member = message.guild.members.get(countRows[j].user_id);
      if (member) {
        outputString +=
          member.displayName +
          '(' +
          member.user.username +
          '): ' +
          countRows[j].cnt +
          ' saved quotes' +
          '\n';
      }
    }
    sassybotRespond(message, outputString);
    return;
  }
  if (hasSingleMention(message)) {
    if (!parts) {
      const rows: QuoteRow[] = getQuotesByUser.all(
        message.guild.id,
        quotedMember.id
      );
      if (rows.length > 0) {
        let selectedQuoted = Math.floor(Math.random() * rows.length);
        let row = rows[selectedQuoted];
        let quote = {
          content: row.quote_text ? row.quote_text : '',
          number: selectedQuoted + 1,
          count: rows.length
        };
        if (!row.quote_text || row.quote_text === '') {
          const channel = client.channels.get(row.channel_id);
          if (channel instanceof TextChannel) {
            channel
              .fetchMessage(row.message_id)
              .then((recalledMessage: Message) => {
                let content = recalledMessage.cleanContent;
                updateMessageText.run([content, row.message_id]);
                quote.content = content;
                sassybotRespond(
                  message,
                  quotedMember.displayName +
                    ' said: "' +
                    quote.content +
                    '" (quote #' +
                    quote.number +
                    ')' +
                    '\n\n' +
                    'and has ' +
                    (quote.count - 1 === 0 ? 'No' : quote.count - 1) +
                    ' other quotes saved'
                );
              });
          }
        } else {
          sassybotRespond(
            message,
            quotedMember.displayName +
              ' said: "' +
              quote.content +
              '" (quote #' +
              quote.number +
              ')' +
              '\n\n' +
              'and has ' +
              (quote.count - 1 === 0 ? 'No' : quote.count - 1) +
              ' other quotes saved'
          );
        }
      }
    } else if (parts.length >= 2 && parts[1].toLowerCase() === 'list') {
      let target = message.author;
      const rows: QuoteRow[] = getQuotesByUser.all([
        message.guild.id,
        quotedMember.id
      ]);

      let builtMessages = [];
      let fetches = [];
      let finalMessage =
        quotedMember.displayName + '\n----------------------------\n';
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
        Promise.all(fetches).then((results: Message[]) => {
          for (let k = 0, kMax = results.length; k < kMax; k++) {
            let content = results[k].cleanContent;
            updateMessageText.run([content, results[k].id]);
          }
          const rows: QuoteRow[] = getQuotesByUser.all([
            message.guild.id,
            quotedMember.id
          ]);
          for (let i = 0, iMax = rows.length; i < iMax; i++) {
            finalMessage += i + 1 + ': ' + rows[i].quote_text + '\n';
          }
          target.send(finalMessage + '----------------------------');
        });
      } else {
        for (let j = 0, jMax = builtMessages.length; j < jMax; j++) {
          finalMessage += j + 1 + ': ' + builtMessages[j] + '\n';
        }
        target.send(finalMessage + '----------------------------');
      }
    } else if (parts.length >= 2 && isNormalInteger(parts[1])) {
      const rows: QuoteRow[] = getQuotesByUser.all([
        message.guild.id,
        quotedMember.id
      ]);
      if (rows.length > 0) {
        let selectedQuoted = Number(parts[1]);
        let row = rows[selectedQuoted - 1];
        let quote = {
          content: row.quote_text ? row.quote_text : '',
          number: selectedQuoted,
          count: rows.length
        };
        if (!row.quote_text || row.quote_text === '') {
          const channel = client.channels.get(row.channel_id);
          if (channel instanceof TextChannel) {
            channel
              .fetchMessage(row.message_id)
              .then((recalledMessage: Message) => {
                let content = recalledMessage.cleanContent;
                updateMessageText.run([content, row.message_id]);
                quote.content = content;
                sassybotRespond(
                  message,
                  quotedMember.displayName +
                    ' said: "' +
                    quote.content +
                    '" (quote #' +
                    quote.number +
                    ')' +
                    '\n\n' +
                    'and has ' +
                    (quote.count - 1 === 0 ? 'No' : quote.count - 1) +
                    ' other quotes saved'
                );
              });
          }
        } else {
          sassybotRespond(
            message,
            quotedMember.displayName +
              ' said: "' +
              quote.content +
              '" (quote #' +
              quote.number +
              ')' +
              '\n\n' +
              'and has ' +
              (quote.count - 1 === 0 ? 'No' : quote.count - 1) +
              ' other quotes saved'
          );
        }
      }
    } else {
      sassybotRespond(message, 'ugh waht ?');
    }
  } else {
    sassybotRespond(
      message,
      'You must specify whose quote you want to retrieve'
    );
  }
};

const quoteExport: SassyBotImport = {
  functions: {
    quote: quoteFunction,
    rquote: rQuoteFunction
  },
  help: {
    rquote:
      'usage: `!{sassybot|sb} rquote [list|int: quote number] {@User}` -- I retrieve a random quote from the tagged users.\n if you specify "list" I will pm you a full list of quotes \n if you specify a number, I will return that exact quote, rather than a random one.',
    quote:
      "usage: `!{sassybot|sb} quote {@User}` -- This command causes me to search through this room's chat history (last 50 messages) for a message sent by the specified @User, which as a :quote: reaction from you, and record that message."
  }
};

export default quoteExport;
