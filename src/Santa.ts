import { Message } from 'discord.js';
import { ISassyBotImport, SassyBotCommand } from './Sassybot';
import SassyDb from './SassyDb';
import Users from './Users';

const particpants = [
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
db.connection.exec('CREATE TABLE IF NOT EXISTS santa_matches (giving TEXT, getting TEXT);');

db.connection.exec('CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT);');

db.connection.exec('CREATE TABLE IF NOT EXISTS user_answers (user TEXT, questionId INTEGER, answer TEXT);');

db.connection.exec('CREATE TABLE IF NOT EXISTS users (id TEXT);');

const insertNewQuestion = db.connection.prepare('INSERT INTO questions (question) VALUES (?)');

const insertAnswer = db.connection.prepare('INSERT INTO user_answers (user, questionId, answer) VALUES (?,?,?)');

function runOnce() {
  const stmt = db.connection.prepare('SELECT COUNT(1) FROM questions;');
  const result = stmt.get();
  if (result && result[0] && parseInt(result[0].count, 10) < 6) {
    // populate
    db.connection.exec(
      "INSERT INTO questions (question) VALUES ('What are your Favorite Hobbies')," +
        " ('Any Favorite Candy/Snacks'), ('Is there something you collect?'), ('Any Dietry Resitrictions/Allergys?')," +
        " ('What Size T-Shirt Do you Wear?'), ('Is There Anything Else Your SS Should Know');",
    );
  }

  const userStmt = db.connection.prepare('SELECT COUNT(1) FROM users;');
  const userResult = stmt.get();
  if (userResult && userResult[0] && parseInt(userResult[0].count, 10) < 6) {
    db.connection.exec(`INSERT INTO users (id) VALUES
        ('${Users.Brigie.id}'),
        ('${Users.Cait.id}'),
        ('${Users.Josh.id}'),
        ('${Users.Nil.id}'),
        ('${Users.Pas.id}'),
        ('${Users.Uriko.id}'),
        ('${Users.Vermillion.id}'),
        ('${Users.Vex.id}');`);
  }
}
runOnce();

const options = { max: 1, time: 5 * 60 * 1000 };

const getAnswer = async (message: Message, questionId: number, question: string): Promise<boolean> => {
  const dmChannel = await message.author.createDM();
  await dmChannel.send(question);
  try {
    const response = (await dmChannel.awaitMessages(() => true, options)).first();
    if (!response) {
      return false;
    }
    try {
      insertNewQuestion.run([message.author.id, questionId, response.content]);
    } catch (e) {
      await dmChannel.send(
        "Sasner is shit at programming message him and tell him he's stupid and the bot doesn\t save answers",
      );
      return false;
    }
    dmChannel.send(`${response.content} -- saved as answer`);
    return true;
  } catch {
    return false;
  }
  return false;
};

const addQuestion = async (message: Message): Promise<boolean> => {
  const dmChannel = await message.author.createDM();
  await dmChannel.send('You have no unanswered questions, would you like to add a question? "yes"/"no" (default: no)');
  try {
    const response = (await dmChannel.awaitMessages(() => true, options)).first();
    if (!response) {
      return false;
    }
    if (!['yes', 'no'].includes(response.content.toLowerCase().trim())) {
      await dmChannel.send('Im not sure what that is so i\'m just going to assume you meant "no"');
      return false;
    }
    if (response.content.toLowerCase().trim() === 'yes') {
      await dmChannel.send('please enter your question');
      const newQuestion = (await dmChannel.awaitMessages(() => true, options)).first();
      if (!newQuestion) {
        return false;
      }
      try {
        insertNewQuestion.run([newQuestion.content]);
      } catch (e) {
        await dmChannel.send(
          "Sasner is shit at programming message him and tell him he's stupid and the bot doesn\t save questions",
        );
        return false;
      }
      await dmChannel.send(`${newQuestion} -- saved, would you like to add another?  "yes"/"no" (default: no)`);
      const secondResponse = (await dmChannel.awaitMessages(() => true, options)).first();
      if (!secondResponse) {
        return false;
      }
      if (!['yes', 'no'].includes(secondResponse.content.toLowerCase().trim())) {
        await dmChannel.send('Im not sure what that is so i\'m just going to assume you meant "no"');
      }
      return secondResponse.content.toLowerCase().trim() === 'yes';
    }
  } catch (e) {
    return false;
  }
  return false;
};

const sendMessage: SassyBotCommand = async (message: Message): Promise<void> => {
  if (!particpants.includes(message.author.id)) {
    return;
  }

  try {
    const unansweredQuestions = db.connection
      .prepare(
        `select questions.id as "id", questions.question as "question" from questions left outer join user_answers on questions.id = user_answers.questionID left outer join users WHERE users.id = '${message.author.id}'`,
      )
      .all();
    if (unansweredQuestions && unansweredQuestions.length) {
      let remainingToAnswer = unansweredQuestions.length;
      let i = 0;
      while (remainingToAnswer) {
        if (await getAnswer(message, unansweredQuestions[i].id, unansweredQuestions[i].question)) {
          i++;
          remainingToAnswer--;
        }
      }
    } else {
      let addAQuestion = true;
      while (addAQuestion) {
        addAQuestion = await addQuestion(message);
      }
      return;
    }
  } catch (e) {
    await message.reply('you have private messages disabled...');
    return;
  }
};

const Santa: ISassyBotImport = {
  functions: {
    ss: sendMessage,
  },
  help: {
    ss: 'sasner is too lazy to fill this shit out.',
  },
};

export default Santa;
