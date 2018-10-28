const Discord = require('discord.js');
const client = new Discord.Client();
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/home/nodebot/data/nodebot.sqlite');
const fs = require('fs');

const pleaseRequired = {
};

let getSecrets = () => {
  return JSON.parse(fs.readFileSync("/home/nodebot/src/client_secrets.json"));
};

let channelList = new Map();
let addSpamChannel, removeSpamChannel, addQuote, getQuotesByUser,
  getQuoteCountByUser, updateMesageText;

let isSassyBotCall = function (messageString) {
  return messageString.toLowerCase().startsWith('!sassybot') || messageString.toLowerCase().startsWith('!sb')
};

let isNormalInteger = function (str) {
  return /^\+?(0|[1-9]\d*)$/.test(str);
};

let processMessage = function (message, randNumber) {
  if (randNumber < 0.01) {
    message.reply('No, fuck you');
    return
  }
  let parsed = message.content.toLowerCase().split(' ');
  if (chatFunctions.hasOwnProperty(parsed[1])) {
    chatFunctions[parsed[1]](message);
  } else {
    message.reply('Sorry I Don\'t Know That Command');
  }
};

let shiftyEyes = function (message) {
  const author_nickname = message.member.nickname ? message.member.nickname : message.author.username;

  let mid;
  let outMessage = '';
  if (mid = message.content.match(/.*\>(\s*.\s*)\>.*/)) {
    outMessage = '<' + mid[1] + '<';
  } else if (mid = message.content.match(/.*\<(\s*.\s*)\<.*/)) {
    outMessage = '>' + mid[1] + '>';
  } else if (mid = author_nickname.match(/.*\<(\s*.\s*)\<.*/)) {
    outMessage = '>' + mid[1] + '> (but only because you named yourself that)';
  } else if (mid = author_nickname.match(/.*\>(\s*.\s*)\>.*/)) {
    outMessage = '<' + mid[1] + '< (but only because you named yourself that)';
  }

  if (outMessage !== '') {
    message.channel.send(outMessage);
  }
};

client.on('ready', () => {
  console.log('I am ready!');
  db.exec('CREATE TABLE IF NOT EXISTS spam_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT) WITHOUT ROWID;');
  db.exec('CREATE TABLE IF NOT EXISTS user_quotes (guild_id TEXT, user_id TEXT, channel_id TEXT, message_id TEXT, timestamp INTEGER, quote_text TEXT);');
  db.all('SELECT * FROM spam_channels', (error, rows) => {
    if (!error) {
      rows.forEach((row) => {
        channelList.set(row.guild_id, row.channel_id);
      });
    }
  });
  addSpamChannel = db.prepare('INSERT INTO spam_channels (guild_id, channel_id) VALUES (?,?);');
  removeSpamChannel = db.prepare('DELETE FROM spam_channels WHERE guild_id = ?;');
  addQuote = db.prepare('INSERT INTO user_quotes (guild_id, user_id, channel_id, message_id, timestamp, quote_text) VALUES (?,?,?,?,strftime(\'%s\',\'now\'),?);');
  getQuotesByUser = db.prepare('SELECT * FROM user_quotes WHERE guild_id = ? AND user_id = ? ORDER BY message_id;');
  getQuoteCountByUser = db.prepare('SELECT COUNT(1) as cnt FROM user_quotes WHERE guild_id = ? AND user_id = ?;');
  updateMesageText = db.prepare('UPDATE user_quotes SET quote_text = ? WHERE message_id = ?;');

});

let chatFunctions = {
  'ping': (message) => {
    console.log('sassybot pinged');
    message.reply('pong');
  },
  'echo': (message) => {
    message.reply(message.content);
  },
  'spam': (message) => {
    channelList.set(message.guild.id, message.channel.id);
    removeSpamChannel.run([message.guild.id]);
    addSpamChannel.run([message.guild.id, message.channel.id]);
    message.reply('Ok, I\'ll spam this channel');
  },
  'rquote': (message) => {
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
                updateMesageText.run([content, row.message_id]);
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
                updateMesageText.run([content, results[k].id]);
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
                updateMesageText.run([content, row.message_id]);
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
        message.reply(content);
      }
    } else {
      message.channel.send('You must specify whose quote you want to retrieve', {disableEveryone: true});
    }
  },
  'quote': (message) => {
    if (message.mentions && message.mentions.members && message.mentions.members.array().length === 1) {
      /** @var GuildMember quotedMember */
      let quotedMember = message.mentions.members.first();
      /** @var TextChannel activeChannel */
      let activeChannel = message.channel;
      activeChannel.fetchMessages({limit: 50, before: message.id}).then(
        (messages) => {
          let messagesWithReactions = messages.filterArray(item => item.author.id === quotedMember.id && item.reactions && item.reactions.array().length > 0 && item.reactions.find(reaction => reaction.emoji.name.includes('quote')));
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
                          message.reply(' ' + 'I\'ve noted that ' + quotedMember.displayName + ' said: "' + reaction.message.cleanContent + '"');
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
  },
  'roll': (message) => {
    let parsed = message.content.split(' ');
    let parsedDice = parsed[2];
    let diceRegex = /^\s*(\d+)d(\d+)$/i;
    let result = parsedDice.match(diceRegex);
    if (result.length === 3) {
      let numDice = parseInt(result[1], 10);
      let diceSides = parseInt(result[2], 10);
      let diceRolls = [];
      for (let i = 0; i < numDice; i++) {
        diceRolls.push(Math.floor(Math.random() * diceSides) + 1);
      }
      message.reply(' ' + JSON.stringify(diceRolls) + ' => ' + diceRolls.reduce((total, num) => total + num))
    }
  },
  'help': (message) => {
    let firstWord = message.content.split(' ');
    if (firstWord.length < 2) {
      firstWord = 'default';
    } else {
      firstWord = firstWord[2];
    }
    let commandList = {
      'echo': 'usage: `!{sassybot|sb} echo {message}` -- I reply with the same message you sent me, Sasner generally uses this for debugging',
      'help': 'usage: `!{sassybot|sb} help [command]` -- I displays a list of commands, and can take a 2nd argument for more details of a command',
      'ping': 'usage: `!{sassybot|sb} ping` -- I reply with "pong" this is a good test to see if i\'m listening at all',
      'roll': 'usage: `!{sassybot|sb} roll {int: number of dies}d{int: number of sides}` -- I roll the specified number of dice, with the specified number of sides, and compute the sum total, as well as list each roll`',
      'rquote': 'usage: `!{sassybot|sb} rquote [list|int: quote number] {@User}` -- I retrieve a random quote from the tagged users.\n if you specify "list" I will pm you a full list of quotes \n if you specify a number, I will return that exact quote, rather than a random one.',
      'spam': 'usage: `!{sassybot|sb}` spam -- this cause me to spam users enter, leaving, or changing voice rooms into the channel this command was specified',
      'quote': 'usage: `!{sassybot|sb} quote {@User}` -- This command causes me to search through this room\'s chat history (last 50 messages) for a message sent by the specified @User, which as a :quote: reaction from you, and record that message.'
    };

    let commands = Object.keys(commandList);
    let reply = '';
    if (commands.includes(firstWord)) {
      reply = commandList[firstWord];
    } else {
      reply = 'Available commands are:\n' + JSON.stringify(commands) + '\nfor more information, you can specify `!{sassybot|sb} help [command]` to get more information about that command';
    }
    message.reply(reply);
  }
};

client.on('voiceStateUpdate', (oldMember, newMember) => {
  let now = '(' + (new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')) + ' GMT) ';
  if (oldMember.voiceChannelID !== newMember.voiceChannelID) {
    if (oldMember.voiceChannelID && !newMember.voiceChannelID && channelList.has(oldMember.guild.id)) {
      let leftChannel = client.channels.get(oldMember.voiceChannelID);
      let msg = now + oldMember.displayName + ' (' + oldMember.user.username + ') has left ' + leftChannel.name;
      client.channels.get(channelList.get(oldMember.guild.id)).send(msg);
    } else if (!oldMember.voiceChannelID && newMember.voiceChannelID && channelList.has(newMember.guild.id)) {
      let joinedChannel = client.channels.get(newMember.voiceChannelID);
      let msg = now + oldMember.displayName + ' (' + oldMember.user.username + ') has joined ' + joinedChannel.name;
      client.channels.get(channelList.get(joinedChannel.guild.id)).send(msg);
    } else {
      if (channelList.has(oldMember.guild.id)) {
        let leftChannel = client.channels.get(oldMember.voiceChannelID);
        let joinedChannel = client.channels.get(newMember.voiceChannelID);
        let msg = now + oldMember.displayName + ' (' + oldMember.user.username + ') has moved from: ' + leftChannel.name + ' to: ' + joinedChannel.name;
        client.channels.get(channelList.get(oldMember.guild.id)).send(msg);
      }
    }
  }
});

client.on('message', message => {
  const d = Math.random();
  const author_id = message.author.id;
  const author_nickname = message.member.nickname ? message.member.nickname : message.author.username;
  if (author_id === sassybotID) {
    return;
  }

  if (d <= 0.09 && author_id !== sasnerID) {
    shiftyEyes(message);
  }

  if (message.content.toLowerCase().includes(':apingree:')) {
    message.reply('oh I hear you like being pinged!');
  }

  if ((dotMatch = message.content.match(/(\.)+/)) && author_id !== sasnerID) {
    if (dotMatch[0].toString() === dotMatch['input'].toString()) {
      message.channel.send(dotMatch['input'].toString() + dotMatch['input'].toString());
      console.log(message.content, dotMatch, dotMatch['input'].toString() + dotMatch['input'].toString());
      return;
    }
  }

  if (
    pleaseRequired.hasOwnProperty(author_id)
    && pleaseRequired[author_id] !== ''
    && message.content.toLowerCase() === 'please'
    && isSassyBotCall(pleaseRequired[author_id].content)
  ) {
    processMessage(pleaseRequired[author_id]);
    pleaseRequired[author_id] = '';
    return;
  }

  if (isSassyBotCall(message.content)) {
    if (pleaseRequired.hasOwnProperty(author_id)) {
      if (!message.content.endsWith(' please')) {
        pleaseRequired[author_id] = message;
        message.reply('only if you say "please"');
        return;
      } else {
        message.content = message.content.slice(0, (-1 * ' please'.length));
      }

    }
    processMessage(message, d);
  } else {
    if (d < 0.0001) {
      message.reply('will you please shut up?')
    }
  }
});

client.login(getSecrets().token);
