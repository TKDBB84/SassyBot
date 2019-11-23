import { Client, Message } from 'discord.js';
import { ISassyBotImport, SassyBotCommand } from './Sassybot';
import SassyDb from './SassyDb';
import Users from './Users';

const particpants = [
  Users.Sasner.id,
  Users.Brigie.id,
  Users.Cait.id,
  Users.Josh.id,
  Users.Nil.id,
  Users.Pas.id,
  Users.Uriko.id,
  Users.Vermillion.id,
  Users.Vex.id,
];

const db = new SassyDb();
db.connection.exec('CREATE TABLE IF NOT EXISTS santa_addresses (user_id TEXT, address TEXT);');

// const insertNewQuestion = db.connection.prepare('INSERT INTO questions (question) VALUES (?)');
// const insertAnswer = db.connection.prepare('INSERT INTO user_answers (user, questionId, answer) VALUES (?,?,?)');
const stmtAddMatch = db.connection.prepare('INSERT INTO santa_matches (giving, getting) VALUES (?,?)');
const truncateMatches = db.connection.prepare('DELETE FROM santa_matches;');

// const options = { max: 1, time: 5 * 60 * 1000 };

// const getAnswer = async (message: Message, questionId: number, question: string): Promise<boolean> => {
//   const dmChannel = await message.author.createDM();
//   await dmChannel.send(question);
//   try {
//     const response = (
//       await dmChannel.awaitMessages((msg: Message) => msg.author.id === message.author.id, options)
//     ).first();
//     if (!response) {
//       return false;
//     }
//     try {
//       insertAnswer.run([message.author.id, questionId, response.content]);
//     } catch (e) {
//       console.error({ e });
//       await dmChannel.send(
//         `Sasner is shit at programming message him and tell him he's stupid and the bot doesn\t save answers and give him this:\n\n ${e.toString()}`,
//       );
//       return false;
//     }
//     dmChannel.send(`${response.content} -- saved as answer`);
//     return true;
//   } catch {
//     return false;
//   }
// };
//
// const addQuestion = async (message: Message): Promise<boolean> => {
//   const dmChannel = await message.author.createDM();
//   await dmChannel.send('You have no unanswered questions, would you like to add a question? "yes"/"no" (default: no)');
//   try {
//     const response = (
//       await dmChannel.awaitMessages((msg: Message) => msg.author.id === message.author.id, options)
//     ).first();
//     if (!response) {
//       return false;
//     }
//     if (!['yes', 'no'].includes(response.content.toLowerCase().trim())) {
//       await dmChannel.send('Im not sure what that is so i\'m just going to assume you meant "no"');
//       return false;
//     }
//     if (response.content.toLowerCase().trim() === 'yes') {
//       await dmChannel.send('please enter your question');
//       const newQuestion = (
//         await dmChannel.awaitMessages((msg: Message) => msg.author.id === message.author.id, options)
//       ).first();
//       if (!newQuestion) {
//         return false;
//       }
//       try {
//         insertNewQuestion.run([newQuestion.content]);
//       } catch (e) {
//         console.error({ e });
//         await dmChannel.send(
//           `Sasner is shit at programming message him and tell him he's stupid and the bot doesn\t save questions and give him this:\n\n ${e.toString()}`,
//         );
//         return false;
//       }
//       await dmChannel.send(`${newQuestion} -- saved, would you like to add another?  "yes"/"no" (default: no)`);
//       const secondResponse = (
//         await dmChannel.awaitMessages((msg: Message) => msg.author.id === message.author.id, options)
//       ).first();
//       if (!secondResponse) {
//         return false;
//       }
//       if (!['yes', 'no'].includes(secondResponse.content.toLowerCase().trim())) {
//         await dmChannel.send('Im not sure what that is so i\'m just going to assume you meant "no"');
//       }
//       return secondResponse.content.toLowerCase().trim() === 'yes';
//     }
//   } catch (e) {
//     return false;
//   }
//   return false;
// };
//
// const sendMessage: SassyBotCommand = async (message: Message): Promise<void> => {
//   if (!particpants.includes(message.author.id)) {
//     return;
//   }
//
//   try {
//     const unansweredQuestions = db.connection.prepare(
//       `select q.id as "id", q.question as "question" from questions as q, users as u left outer join user_answers on u.id = user_answers.user WHERE u.id = '${message.author.id}' and answer is null;`,
//     );
//     const unasnwered = unansweredQuestions.all();
//     if (unasnwered && unasnwered.length) {
//       let remainingToAnswer = unasnwered.length;
//       let i = 0;
//       while (remainingToAnswer) {
//         if (await getAnswer(message, unasnwered[i].id, unasnwered[i].question)) {
//           i++;
//           remainingToAnswer--;
//         }
//       }
//       let addAQuestion = true;
//       while (addAQuestion) {
//         addAQuestion = await addQuestion(message);
//       }
//       return;
//     } else {
//       let addAQuestion = true;
//       while (addAQuestion) {
//         addAQuestion = await addQuestion(message);
//       }
//       return;
//     }
//   } catch (e) {
//     await message.reply('you have private messages disabled...');
//     return;
//   }
// };

const makeMatches: SassyBotCommand = async (message: Message) => {
  if (message.author.id !== Users.Sasner.id) {
    return;
  }
  let targets = [...particpants];
  let givers = [...particpants];
  targets.shift();
  givers.shift();
  while (targets.length) {
    if (targets.length === 1 && givers.length === 1 && targets[0] === givers[0]) {
      targets = [...particpants];
      givers = [...particpants];
      targets.shift();
      givers.shift();
      truncateMatches.run();
    }
    const giver = givers.shift();
    let target: string;
    do {
      target = targets[Math.floor(Math.random() * targets.length)];
    } while (target === giver);
    targets = targets.filter((i) => i !== target);
    stmtAddMatch.run([giver, target]);
  }
};

const getAddresses: SassyBotCommand = async (message: Message, client?: Client) => {
  if (!client) {
    return;
  }
  const stmtAddress = db.connection.prepare('SELECT user_id FROM santa_addresses');
  const stmtInsertAddress = db.connection.prepare('INSERT INTO santa_addresses (user_id, address) VALUES (?,?)');
  const stmtUpdateAddress = db.connection.prepare('UPDATE santa_addresses set address = ? WHERE user_id = ?');
  const allRows = stmtAddress.all();
  const allIds = allRows.map((row) => row.user_id);
  if (message.author.id === Users.Sasner.id) {
    const sasner = await client.fetchUser(Users.Sasner.id, true);
    const sasnerDm = await sasner.createDM();
    const sentTo = [];
    const neededAddresses = particpants.filter((userId) => userId !== Users.Sasner.id && !allIds.includes(userId));
    for (const userId of neededAddresses) {
      const targetUser = await client.fetchUser(userId, true);
      sentTo.push(targetUser.username);
      const dmChannel = await targetUser.createDM();
      await dmChannel.send("Give Me your name & Address, like you'd address a package");
      const reply = await dmChannel.awaitMessages((msg) => msg.author.id === userId, { max: 1, time: 30 * 60000 });
      if (reply) {
        stmtInsertAddress.run([message.author.id, message.content]);
        dmChannel.send(`${message.content} --- Saved`);
      } else {
        dmChannel.send('I gave up waiting for you. You can do `!sb ssAddress` to get this prompt again');
      }
    }
    await sasnerDm.send('messages sent to: ' + JSON.stringify(sentTo));
  } else {
    const targetUser = await client.fetchUser(message.author.id, true);
    const dmChannel = await targetUser.createDM();
    await dmChannel.send("Give Me your name & Address, like you'd address a package");
    const reply = await dmChannel.awaitMessages((msg) => msg.author.id === message.author.id, {
      max: 1,
      time: 30 * 60000,
    });
    if (reply) {
      if (allIds.includes(message.author.id)) {
        stmtUpdateAddress.run([message.content, message.author.id]);
      } else {
        stmtInsertAddress.run([message.author.id, message.content]);
      }
      dmChannel.send(`${message.content} --- Saved`);
    } else {
      dmChannel.send('I gave up waiting for you. You can do `!sb ssAddress` to get this prompt again');
    }
  }
};

const Santa: ISassyBotImport = {
  functions: {
    ssaddress: getAddresses,
    ssmatch: makeMatches,
  },
  help: {
    ssaddress: 'fdsa',
    ssmatch: 'dfasfd',
  },
};

export default Santa;
