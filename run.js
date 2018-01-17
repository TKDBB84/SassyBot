const Discord = require('discord.js');
const client = new Discord.Client();
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/home/nodebot/data/nodebot.sqlite');
const fs = require('fs');

let getSecrets = () => {
    return JSON.parse(fs.readFileSync("client_secrets.json"));
};

let channelList = new Map();
let addRow, removeRow;

client.on('ready', () => {
    console.log('I am ready!');
    db.exec('CREATE TABLE IF NOT EXISTS spam_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT) WITHOUT ROWID;');
    db.all('SELECT * FROM spam_channels', (error, rows) => {
        if(!error) {
            rows.forEach((row) => {
                channelList.set(row.guild_id, row.channel_id);
            });
        }
    });
    addRow = db.prepare('INSERT INTO spam_channels (guild_id, channel_id) VALUES (?,?);');
    removeRow = db.prepare('DELETE FROM spam_channels WHERE guild_id = ?;');
});

client.on('voiceStateUpdate', (oldMember, newMember) => {
    if (oldMember.voiceChannelID !== newMember.voiceChannelID) {
        if (oldMember.voiceChannelID && !newMember.voiceChannelID && channelList.has(oldMember.guild.id)) {
            let leftChannel = client.channels.get(oldMember.voiceChannelID);
            let msg = oldMember.user.username + ' has left ' + leftChannel.name;
            client.channels.get(channelList.get(oldMember.guild.id)).send(msg);
        } else if (!oldMember.voiceChannelID && newMember.voiceChannelID && channelList.has(newMember.guild.id)) {
            let joinedChannel = client.channels.get(newMember.voiceChannelID);
            let msg = oldMember.user.username + ' has joined ' + joinedChannel.name;
            client.channels.get(channelList.get(joinedChannel.guild.id)).send(msg);
        } else {
            if (channelList.has(oldMember.guild.id)) {
                let leftChannel = client.channels.get(oldMember.voiceChannelID);
                let joinedChannel = client.channels.get(newMember.voiceChannelID);
                let msg = oldMember.user.username + ' has moved from: ' + leftChannel.name + ' to: ' + joinedChannel.name;
                client.channels.get(channelList.get(oldMember.guild.id)).send(msg);
            }
        }
    }
});

client.on('message', message => {
    if (message.content.toLowerCase().startsWith('!sassybot')) {
        let messageCommands = {
            'ping': () => {
                message.reply('pong');
            },
            'spam': () => {
                channelList.set(message.guild.id, message.channel.id);
                removeRow.run([message.guild.id]);
                addRow.run([message.guild.id, message.channel.id]);
                message.reply('Ok, I\'ll spam this channel');
            },
            'roll': () => {
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
                    message.reply(JSON.stringify(diceRolls) + ' => ' + diceRolls.reduce((total, num)=> total + num))
                }
            }
        };
        let parsed = message.content.split(' ');
        if (messageCommands.hasOwnProperty(parsed[1])) {
            messageCommands[parsed[1]]();
        } else {
            message.reply('Sorry I Don\'t Know That Command');
        }
    }
});
client.login(getSecrets().token);
