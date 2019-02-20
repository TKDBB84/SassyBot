const Users = require('./Users.js');

const ss = (message) => {
  // do nothing, SS is over
};

module.exports = {
  functions: {
    'ss': ss,
  },
  help: {
    'ss': 'usage: `!{sassybot|sb} ss` -- I retrieve the details of your secret santa assignment, and message it to you privately',
  }
};
