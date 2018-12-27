const Users = require('./Users.js');

const ss = (message) => {
  let reply = 'You didn\'t sign up for the secret santa';
  switch (getAuthorId(message)) {
    // man wouldn't you guys like to know
  }

  message.author.send(reply);
};

module.exports = {
  functions: {
    'ss': ss,
  },
  help: {
    'ss': 'usage: `!{sassybot|sb} ss` -- I retrieve the details of your secret santa assignment, and message it to you privately',
  }
};
