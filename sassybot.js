const Discord = require('discord.js');
const client = new Discord.Client();
const db = require('./SassyDB.js');
const fs = require('fs');

const Users = require('./Users.js');
const quoteFunctions = require('./Quotes.js');

const functionImports = [
  quoteFunctions
];

const pleaseRequiredList = {};

const getSecrets = () => {
  return JSON.parse(fs.readFileSync("/home/nodebot/src/client_secrets.json"));
};

let channelList = new Map();
let addSpamChannel, removeSpamChannel, addQuote, getQuotesByUser, updateMessageText;

const isSassyBotCall = function (message) {
  return message.content.toLowerCase().startsWith('!sassybot') || message.content.toLowerCase().startsWith('!sb')
};

const rollFunction = (message) => {
  const parsedDice = message.content.split(' ')[2];
  const result = parsedDice.match(/^\s*(\d+)d(\d+)$/i);
  if (result && result.length === 3) {
    const numDice = parseInt(result[1], 10);
    const diceSides = parseInt(result[2], 10);
    if (numDice === 0 || diceSides === 0) {
      return;
    }
    let diceRolls = [];
    for (let i = 0; i < numDice; i++) {
      diceRolls.push(Math.floor(Math.random() * diceSides) + 1);
    }
    message.reply(' ' + JSON.stringify(diceRolls, null, 1).replace(/\n/g, '') + ' => ' + diceRolls.reduce((total, num) => total + num))
  }
};

const getAuthorId = (message) => {
  return message.author.id;
};

const getDisplayName = function (message) {
  return message.member.nickname ? message.member.nickname : message.author.username;
};

const processMessage = function (message, randNumber) {
  const author_id = getAuthorId(message);
  if (randNumber < 0.01) {
    message.channel.send('No, fuck you');
    return
  }

  if (pleaseRequiredList.hasOwnProperty(author_id)) {
    if (!message.content.endsWith(' please')) {
      pleaseRequiredList[author_id] = message;
      message.channel.send('only if you say "please"', {disableEveryone: true});
      return;
    } else {
      message.content = message.content.slice(0, (-1 * ' please'.length));
    }

  }

  let parsed = message.content.toLowerCase().split(' ');
  if (chatFunctions.hasOwnProperty(parsed[1])) {
    chatFunctions[parsed[1]](message);
  } else {
    message.channel.send('Sorry I Don\'t Know That Command', {disableEveryone: true});
  }
};

const helpFunction = (message) => {
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
    'spam': 'usage: `!{sassybot|sb}` spam -- this cause me to spam users enter, leaving, or changing voice rooms into the channel this command was specified',
  };

  for ( let j = 0 ; j < functionImports.length ; j++ ) {
    commandList = Object.assign({}, functionImports[j].help, commandList);
  }

  const orderedList = {};
  Object.keys(commandList).sort().forEach((key) => {
    orderedList[key] = commandList[key];
  });

  let commands = Object.keys(commandList);
  let reply = '';
  if (commands.includes(firstWord)) {
    reply = commandList[firstWord];
  } else {
    reply = 'Available commands are:\n' + JSON.stringify(orderedList) + '\nfor more information, you can specify `!{sassybot|sb} help [command]` to get more information about that command';
  }
  message.channel.send(reply, {disableEveryone: true});
};

const spamFunction = (message) => {
  const author_id = getAuthorId(message);
  if (author_id === Users.sasner.id || author_id === Users.verian.id) {
    channelList.set(message.guild.id, message.channel.id);
    removeSpamChannel.run([message.guild.id]);
    addSpamChannel.run([message.guild.id, message.channel.id]);
    message.channel.send('Ok, I\'ll spam this channel', {disableEveryone: true});
  } else {
    message.channel.send('This functionality is limited to Verian & Sasner', {disableEveryone: true})
  }
};

const shiftyEyes = function (message) {
  let outMessage = '';
  const leftEyes = /.*\<(\s*.\s*)\<.*/;
  const rightEyes = /.*\>(\s*.\s*)\>.*/;

  const message_left = message.content.match(leftEyes);
  const message_right = message.content.match(rightEyes);
  let left_response = '', left_eyes = '',
      right_response = '', right_eyes = '';
  if (message_left) {
    left_eyes = '<' + message_left[1] + '<';
    left_response = '>' + message_left[1] + '>';
  }
  if (message_right) {
    right_eyes = '>' + message_right[1] + '>';
    right_response = '<' + message_right[1] + '<';
  }

  if (message_left && message_right) {
    if (message.content.indexOf(left_eyes) < message.content.indexOf(right_eyes)) {
      outMessage = left_response + '  ' + right_response;
    } else {
      outMessage = right_response + '  ' + left_response;
    }
  } else if (message_left) {
    outMessage = left_response;
  } else if (message_right) {
    outMessage = right_response;
  }

  if (outMessage === '') {
    const author_nickname = getDisplayName(message);
    const author_left = author_nickname.match(leftEyes);
    const author_right = author_nickname.match(rightEyes);
    if (author_left) {
      outMessage = '>' + author_left[1] + '>  (but only because you named yourself that)';
    } else if (author_right) {
      outMessage = '<' + author_right[1] + '<  (but only because you named yourself that)';
    }
  }

  if (outMessage !== '') {
    message.channel.send(outMessage, {disableEveryone: true});
    return false;
  }
  return true;
};

client.on('ready', () => {

  // fetch channels per server to spam joining an leaving
  db.all('SELECT * FROM spam_channels', (error, rows) => {
    if (!error) {
      rows.forEach((row) => {
        channelList.set(row.guild_id, row.channel_id);
      });
    }
  });

  // create tables if they don't exists:
  db.exec('CREATE TABLE IF NOT EXISTS spam_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT) WITHOUT ROWID;');

  // setup runtime queries as prepared to negate sql injection
  addSpamChannel = db.prepare('INSERT INTO spam_channels (guild_id, channel_id) VALUES (?,?);');
  removeSpamChannel = db.prepare('DELETE FROM spam_channels WHERE guild_id = ?;');

  // setup ready to go
  console.log('I am ready!');
});


const aPingRee = (message) => {
  if (
    message.content.toLowerCase().includes(':apingree:')
    || message.content.toLowerCase().includes(':angeryping:')
  ) {
    message.channel.send('oh I hear you like being pinged!', {disableEveryone: true});
    return false;
  }
  return true;
};


const moreDots = (message) => {
  const dotMatch = message.content.match(/(\.)+/);
  if (dotMatch && dotMatch[0].toString() === dotMatch['input'].toString()) {
    message.channel.send(dotMatch['input'].toString() + dotMatch['input'].toString(), {disableEveryone: true});
    return false;
  }
  return true;
};


const processPleaseStatement = (message) => {
  const author_id = getAuthorId(message);
  if (
    pleaseRequiredList.hasOwnProperty(author_id)
    && pleaseRequiredList[author_id] !== ''
    && message.content.toLowerCase() === 'please'
    && isSassyBotCall(pleaseRequiredList[author_id].content)
  ) {
    processMessage(pleaseRequiredList[author_id]);
    pleaseRequiredList[author_id] = '';
    return false;
  }
  return true;
};


const pleaseShutUp = (message) => {
  message.reply('will you please shut up?');
  return false;
};

const teaIsBad = (message) => {
  if (message.content.toLowerCase().includes('tea') ) {
    message.channel.send('_dumps all the tea into the harbor... where it belongs_');
  }
  return true;
};

const commandTrollFunctions = {};

const preProcessTrollFunctions = {
  'shiftyEyes': {
    'process': shiftyEyes,
    'chance': 0.07
  },
  'aPingRee': {
    'process': aPingRee,
    'chance': 1.00
  },
  'moreDots': {
    'process': moreDots,
    'chance': 0.25
  },
  'processPleaseStatement': {
    'process': processPleaseStatement,
    'chance': 1.00
  },
  'pleaseShutUp': {
    'process': pleaseShutUp,
    'chance': 0.0001
  },
  'teaIsBad': {
    'process': teaIsBad,
    'chance': 0.25
  }
};

let chatFunctions = {
  'ping': (message) => {
    message.channel.send('pong');
  },
  'echo': (message) => {
    message.channel.send(message.content, {disableEveryone: true});
  },
  'spam': spamFunction,
  'roll': rollFunction,
  'help': helpFunction
};

for ( let j = 0 ; j < functionImports.length ; j++ ) {
  chatFunctions = Object.assign({}, functionImports[j].functions, chatFunctions);
}

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
  const random_number = Math.random();
  const author_id = getAuthorId(message);

  if (author_id === Users.sassybot.id) {
    // SassyBot is not allowed to respond to itself
    return;
  }


  if (author_id !== Users.sasner.id) {

    let continueProcess = true;
    for (const funcName in preProcessTrollFunctions) {
      if (preProcessTrollFunctions.hasOwnProperty(funcName)) {
        if (random_number < preProcessTrollFunctions[funcName].chance) {
          continueProcess = preProcessTrollFunctions[funcName].process(message) && continueProcess;
        }
      }
    }

    if (!continueProcess) {
      return;
    }
  }

  if (isSassyBotCall(message)) {
    processMessage(message, random_number);
  }
});

client.login(getSecrets().token);
