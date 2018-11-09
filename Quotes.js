
const hasSingleMention = (message) => {
  return message.mentions && message.mentions.members && message.mentions.members.array().length === 1;
};

const hasReaction = (message) => {
  return message.reactions && message.reactions.array().length > 0;
};

const hasQuoteReaction = (message) => {
  return message.reactions.find(
      (reaction) => {
        return reaction.emoji.name.includes('quote')
      }
    );
};

const quoteFunction = (message) => {
  if (hasSingleMention(message)) {
    /** @var GuildMember quotedMember */
    let quotedMember = message.mentions.members.first();
    /** @var TextChannel activeChannel */
    let activeChannel = message.channel;
    activeChannel.fetchMessages({limit: 50, before: message.id}).then(
      (messages) => {
        let messagesWithReactions = messages.filter(
          (item) => {
            return item.author.id === quotedMember.id
              && hasReaction(item)
              && hasQuoteReaction(item)
          }
        ).array();

        let foundOne = false;
        for (let i = 0, iMax = messagesWithReactions.length; i < iMax; i++) {
          messagesWithReactions[i].reactions.forEach(
            (reaction) => {
              if (!foundOne) {
                reaction.fetchUsers().then(
                  (users) => {
                    if (users.get(message.author.id) && !foundOne) {
                      if (reaction.message.cleanContent !== '') {
                        addQuote.run([message.guild.id, reaction.message.author.id, activeChannel.id, reaction.message.id, reaction.message.cleanContent]);
                        message.channel.send("I've noted that " + quotedMember.displayName + ' said: "' + reaction.message.cleanContent + '"', {disableEveryone: true});
                        foundOne = true;
                      }
                    }
                  }
                );
              }
            }
          )
        }
      }
    );
  }
};


const rQuoteFunction = (message) => {
  if (message.mentions && message.mentions.members && message.mentions.members.array().length === 1) {
    let content;
    let parts = message.content.match(/\!(?:sassybot|sb)\srquote\s(?:@\w+)?(\d+|list)\s?(?:@\w+)?/i);
    let quotedMember = message.mentions.members.first();
    if (!parts) {
      getQuotesByUser.all([message.guild.id, quotedMember.id], (error, rows) => {
        if (!error && rows.length > 0) {
          let selectedQuoted = Math.floor(Math.random() * rows.length);
          let row = rows[selectedQuoted];
          let quote = {
            content: row.quote_text ? row.quote_text : '',
            number: selectedQuoted + 1,
            count: rows.length
          };
          if (!row.quote_text || row.quote_text === '') {
            client.channels.get(row.channel_id).fetchMessage(row.message_id).then((recalledMessage) => {
              let content = recalledMessage.cleanContent;
              updateMessageText.run([content, row.message_id]);
              quote.content = content;
              message.channel.send(quotedMember.displayName + ' said: "' + quote.content + '" (quote #' + quote.number + ')', {disableEveryone: true});
              message.channel.send('and has ' + ((quote.count - 1) === 0 ? 'No' : (quote.count - 1)) + ' other quotes saved');
            });
          } else {
            message.channel.send(quotedMember.displayName + ' said: "' + quote.content + '" (quote #' + quote.number + ')', {disableEveryone: true});
            message.channel.send('and has ' + ((quote.count - 1) === 0 ? 'No' : (quote.count - 1)) + ' other quotes saved');
          }
        }
      });
    } else if (parts.length >= 2 && parts[1].toLowerCase() === 'list') {
      let target = message.author;
      getQuotesByUser.all([message.guild.id, quotedMember.id], (error, rows) => {
        let builtMessages = [];
        let fetches = [];
        let finalMessage = quotedMember.displayName + '\n----------------------------\n';
        for (let i = 0, iMax = rows.length; i < iMax; i++) {
          let row = rows[i];
          if (!row.quote_text || row.quote_text === '') {
            fetches.push(client.channels.get(row.channel_id).fetchMessage(row.message_id));
          } else {
            builtMessages[i] = row.quote_text;
          }
        }
        if (fetches.length > 0) {
          Promise.all(fetches).then((results) => {
            for (let k = 0, kMax = results.length; k < kMax; k++) {
              let content = results[k].cleanContent;
              updateMessageText.run([content, results[k].id]);
            }
            getQuotesByUser.all([message.guild.id, quotedMember.id], (error, rows) => {
              for (let i = 0, iMax = rows.length; i < iMax; i++) {
                finalMessage += (i + 1) + ': ' + rows[i].quote_text + '\n';
              }
              target.send(finalMessage + '----------------------------');
            });
          });
        } else {
          for (let j = 0, jMax = builtMessages.length; j < jMax; j++) {
            finalMessage += (j + 1) + ': ' + builtMessages[j] + '\n';
          }
          target.send(finalMessage + '----------------------------');
        }
      });
    } else if (parts.length >= 2 && isNormalInteger(parts[1])) {
      getQuotesByUser.all([message.guild.id, quotedMember.id], (error, rows) => {
        if (!error && rows.length > 0) {
          let selectedQuoted = Number(parts[1]);
          let row = rows[selectedQuoted - 1];
          let quote = {
            content: row.quote_text ? row.quote_text : '',
            number: selectedQuoted,
            count: rows.length
          };
          if (!row.quote_text || row.quote_text === '') {
            client.channels.get(row.channel_id).fetchMessage(row.message_id).then((recalledMessage) => {
              let content = recalledMessage.cleanContent;
              updateMessageText.run([content, row.message_id]);
              quote.content = content;
              message.channel.send(quotedMember.displayName + ' said: "' + quote.content + '" (quote #' + quote.number + ')', {disableEveryone: true});
              message.channel.send('and has ' + ((quote.count - 1) === 0 ? 'No' : (quote.count - 1)) + ' other quotes saved');
            });
          } else {
            message.channel.send(quotedMember.displayName + ' said: "' + quote.content + '" (quote #' + quote.number + ')', {disableEveryone: true});
            message.channel.send('and has ' + ((quote.count - 1) === 0 ? 'No' : (quote.count - 1)) + ' other quotes saved');
          }
        }
      });
    } else {
      content = "ugh waht ? ";
      message.channel.send(content, {disableEveryone: true});
    }
  } else {
    message.channel.send('You must specify whose quote you want to retrieve', {disableEveryone: true});
  }
};

module.exports = {
  functions: {
    'quote': quoteFunction,
    'rquote': rQuoteFunction,
  },
  help: {
    'rquote': 'usage: `!{sassybot|sb} rquote [list|int: quote number] {@User}` -- I retrieve a random quote from the tagged users.\n if you specify "list" I will pm you a full list of quotes \n if you specify a number, I will return that exact quote, rather than a random one.',
    'quote': 'usage: `!{sassybot|sb} quote {@User}` -- This command causes me to search through this room\'s chat history (last 50 messages) for a message sent by the specified @User, which as a :quote: reaction from you, and record that message.'
  }
};
