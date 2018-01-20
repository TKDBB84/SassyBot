const Discord = require('discord.js');
const client = new Discord.Client();
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/home/nodebot/data/nodebot.sqlite');
const fs = require('fs');

let getSecrets = () => {
    return JSON.parse(fs.readFileSync("/home/nodebot/src/client_secrets.json"));
};
let channelList = new Map();
let addSpamChannel, removeSpamChannel, addQuote, getQuotesByUser;


client.on('ready', () => {
    console.log('I am ready!');
    db.exec('CREATE TABLE IF NOT EXISTS spam_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT) WITHOUT ROWID;');
    db.exec('CREATE TABLE IF NOT EXISTS user_quotes (guild_id TEXT, user_id TEXT, message_id TEXT, timestamp INTEGER);');
    db.all('SELECT * FROM spam_channels', (error, rows) => {
        if(!error) {
            rows.forEach((row) => {
                channelList.set(row.guild_id, row.channel_id);
            });
        }
    });
    addSpamChannel = db.prepare('INSERT INTO spam_channels (guild_id, channel_id) VALUES (?,?);');
    removeSpamChannel = db.prepare('DELETE FROM spam_channels WHERE guild_id = ?;');
    addQuote = db.prepare('INSERT INTO user_quotes (guild_id, user_id, message_id, timestamp) VALUES (?,?,?,strftime(\'%s\',\'now\'));');
    getQuotesByUser = db.prepare('SELECT * FROM user_quotes WHERE guild_id = ? AND user_id = ?');
});

let chatFunctions = {
    'ping': (message) => {
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
                    let row = rows[Math.floor(Math.random() * rows.length)];
                    message.channel.fetchMessage(row.message_id).then((recalledMessage) => {
                        let content = recalledMessage.cleanContent;
                        let embed = null;
                        if ( recalledMessage.embeds && recalledMessage.embeds.length > 0 ) {
                            // discord JS can only deal w/ 1 embed at a time
                            /** @var MessageEmbed tmp */
                            let tmp = recalledMessage.embeds[0];
                            embed = {
                                title: tmp.title,
                                type: tmp.type,
                                description: tmp.description,
                                url: tmp.url,
                                timestamp: tmp.createdTimestamp,
                                color: tmp.color,
                                footer: tmp.footer ? {
                                    'text': tmp.footer.text,
                                    'icon_url': tmp.footer.iconURL,
                                    'proxy_icon_url': tmp.footer.proxyIconUrl
                                } : {},
                                image: tmp.image ? {
                                    'url': tmp.image.url,
                                    'proxy_url': tmp.image.proxyURL,
                                    'height': tmp.image.height,
                                    'width': tmp.image.width
                                } : {},
                                thumbnail: tmp.thumbnail ? {
                                    'url': tmp.thumbnail.url,
                                    'proxy_url': tmp.thumbnail.proxyURL,
                                    'height': tmp.thumbnail.height,
                                    'width': tmp.thumbnail.width
                                } : {},
                                video: tmp.video ? {
                                    'url': tmp.video.url,
                                    'height': tmp.video.height,
                                    'width': tmp.video.width
                                } : {},
                                provider: tmp.provider ? {
                                    'name': tmp.provider.name,
                                    'url': tmp.provider.url
                                } : {},
                                author: tmp.author ? {
                                    'name': tmp.author.name,
                                    'url': tmp.author.url,
                                    'icon_url': tmp.author.iconURL
                                } : {},
                                fields: (() => {
                                    let result = [];
                                    for (let i = 0, iMax = tmp.fields.length ; i < iMax ; i++) {
                                        result.push(
                                            tmp[i].fields.map(
                                                (item) => {
                                                    return {
                                                        'inline': item.inline,
                                                        'name': item.name,
                                                        'value': item.value
                                                    }
                                                }
                                            )
                                        );
                                    }
                                    return result;
                                })()
                            }
                        }
                        messageOptions = {
                            disableEveryone: true,
                            embed: embed ? embed : {}
                        };
                        message.channel.send(quotedMember.displayName + ' said: "' + content + '"', messageOptions);
                        message.channel.send('and has ' + ((rows.length - 1) === 0 ? 'No' : (rows.length - 1))  + ' other quotes saved');
                    });
                }
            });
        } else {

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
                                                addQuote.run([message.guild.id, reaction.message.author.id, reaction.message.id]);
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
    }
};

client.on('voiceStateUpdate', (oldMember, newMember) => {
    if (oldMember.voiceChannelID !== newMember.voiceChannelID) {
        if (oldMember.voiceChannelID && !newMember.voiceChannelID && channelList.has(oldMember.guild.id)) {
            let leftChannel = client.channels.get(oldMember.voiceChannelID);
            let msg = oldMember.displayName + ' has left ' + leftChannel.name;
            client.channels.get(channelList.get(oldMember.guild.id)).send(msg);
        } else if (!oldMember.voiceChannelID && newMember.voiceChannelID && channelList.has(newMember.guild.id)) {
            let joinedChannel = client.channels.get(newMember.voiceChannelID);
            let msg = oldMember.displayName + ' has joined ' + joinedChannel.name;
            client.channels.get(channelList.get(joinedChannel.guild.id)).send(msg);
        } else {
            if (channelList.has(oldMember.guild.id)) {
                let leftChannel = client.channels.get(oldMember.voiceChannelID);
                let joinedChannel = client.channels.get(newMember.voiceChannelID);
                let msg = oldMember.displayName + ' has moved from: ' + leftChannel.name + ' to: ' + joinedChannel.name;
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
