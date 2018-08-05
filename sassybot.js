const Discord = require('discord.js');
const client = new Discord.Client();
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/home/nodebot/data/nodebot.sqlite');
const fs = require('fs');

let getSecrets = () => {
    return JSON.parse(fs.readFileSync("/home/nodebot/src/client_secrets.json"));
};
let channelList = new Map();
let addSpamChannel, removeSpamChannel, addQuote, getQuotesByUser,
    getQuoteCountByUser, updateMesageText;


client.on('ready', () => {
    console.log('I am ready!');
    db.exec('CREATE TABLE IF NOT EXISTS spam_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT) WITHOUT ROWID;');
    db.exec('CREATE TABLE IF NOT EXISTS user_quotes (guild_id TEXT, user_id TEXT, channel_id TEXT, message_id TEXT, timestamp INTEGER, quote_text TEXT);');
    db.all('SELECT * FROM spam_channels', (error, rows) => {
        if(!error) {
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
        message.reply(JSON.stringify(message.embed.length, message.embed[0].fields));
    },
    'spam': (message) => {
        channelList.set(message.guild.id, message.channel.id);
        removeSpamChannel.run([message.guild.id]);
        addSpamChannel.run([message.guild.id, message.channel.id]);
        message.reply('Ok, I\'ll spam this channel');
    },
    'rquote': (message) => {
        if (message.mentions && message.mentions.members && message.mentions.members.array().length === 1) {
            let quotedMember = message.mentions.members.first();
            getQuotesByUser.all([message.guild.id, quotedMember.id], (error, rows) => {
                if(!error && rows.length > 0) {
                    let selectedQuoted = Math.floor(Math.random() * rows.length);
                    let row = rows[selectedQuoted];
                    selectedQuoted += 1;
                    if (row.quote_text && row.quote_text !== '') {
                        message.channel.send(quotedMember.displayName + ' said: "' + content + '" (quote #' + selectedQuoted + ')', {disableEveryone: true});
                        message.channel.send('and has ' + ((rows.length - 1) === 0 ? 'No' : (rows.length - 1)) + ' other quotes saved');
                    } else {
                        client.channels.get(row.channel_id).fetchMessage(row.message_id).then((recalledMessage) => {
                            let content = recalledMessage.cleanContent;
                            message.channel.send(quotedMember.displayName + ' said: "' + content + '" (quote #' + selectedQuoted + ')', {disableEveryone: true});
                            message.channel.send('and has ' + ((rows.length - 1) === 0 ? 'No' : (rows.length - 1)) + ' other quotes saved');
                            updateMesageText.run([row.message_id, content]);
                        });
                    }
                }
            });
        } else {
            message.channel.send('You must specify who\'s quote you want to retrieve', {disableEveryone: true});
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
                    for (let i = 0, iMax = messagesWithReactions.length ; i < iMax ; i++) {
                        messagesWithReactions[i].reactions.forEach(
                            (reaction) => {
                                if (!foundOne) {
                                    reaction.fetchUsers().then(
                                        (users) => {
                                            if (users.get(message.author.id) && !foundOne) {
                                                addQuote.run([message.guild.id, reaction.message.author.id, activeChannel.id, reaction.message.id, reaction.message.cleanContent]);
                                                message.reply(' ' + 'I\'ve noted that ' + quotedMember.displayName + ' said: "' + reaction.message.cleanContent +  '"');
                                                foundOne = true;
                                            }
                                        }
                                    );
                                }
                            }
                        )
                    }
                });
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
            for (let i = 0 ; i < numDice ; i++) {
                diceRolls.push(Math.floor(Math.random() * diceSides) + 1);
            }
            message.reply(' ' + JSON.stringify(diceRolls) + ' => ' + diceRolls.reduce((total, num)=> total + num))
        }
    }//, 'purge': (message) => { message.reply('ok: commencing a purge...'); }
};

client.on('voiceStateUpdate', (oldMember, newMember) => {
    let now = '(' + (new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')) + ' GMT) ';
    if (oldMember.voiceChannelID !== newMember.voiceChannelID) {
        if (oldMember.voiceChannelID && !newMember.voiceChannelID && channelList.has(oldMember.guild.id)) {
            let leftChannel = client.channels.get(oldMember.voiceChannelID);
            let msg = now + oldMember.displayName + ' has left ' + leftChannel.name;
            client.channels.get(channelList.get(oldMember.guild.id)).send(msg);
        } else if (!oldMember.voiceChannelID && newMember.voiceChannelID && channelList.has(newMember.guild.id)) {
            let joinedChannel = client.channels.get(newMember.voiceChannelID);
            let msg = now + oldMember.displayName + ' has joined ' + joinedChannel.name;
            client.channels.get(channelList.get(joinedChannel.guild.id)).send(msg);
        } else {
            if (channelList.has(oldMember.guild.id)) {
                let leftChannel = client.channels.get(oldMember.voiceChannelID);
                let joinedChannel = client.channels.get(newMember.voiceChannelID);
                let msg = now + oldMember.displayName + ' has moved from: ' + leftChannel.name + ' to: ' + joinedChannel.name;
                client.channels.get(channelList.get(oldMember.guild.id)).send(msg);
            }
        }
    }
});

client.on('message', message => {
    if (message.content.toLowerCase().startsWith('!sassybot')) {
        let parsed = message.content.toLowerCase().split(' ');
        if (chatFunctions.hasOwnProperty(parsed[1])) {
            chatFunctions[parsed[1]](message);
        } else {
            message.reply('Sorry I Don\'t Know That Command');
        }
    }
});

client.login(getSecrets().token);
