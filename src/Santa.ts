import { Message } from 'discord.js';
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
const insertNewQuestion = db.connection.prepare('INSERT INTO questions (question) VALUES (?)');
const insertAnswer = db.connection.prepare('INSERT INTO user_answers (user, questionId, answer) VALUES (?,?,?)');

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
      insertAnswer.run([message.author.id, questionId, response.content]);
    } catch (e) {
      console.log({e});
      await dmChannel.send(
        `Sasner is shit at programming message him and tell him he's stupid and the bot doesn\t save answers and give him this:\n\n ${e.toString()}`,
      );
      return false;
    }
    dmChannel.send(`${response.content} -- saved as answer`);
    return true;
  } catch {
    return false;
  }
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
        console.error({ e });
        await dmChannel.send(
          `Sasner is shit at programming message him and tell him he's stupid and the bot doesn\t save questions and give him this:\n\n ${e.toString()}`,
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
    const unansweredQuestions = db.connection.prepare(
      `select q.id as "id", q.question as "question" from questions as q, users as u left outer join user_answers on u.id = user_answers.user WHERE u.id = '${message.author.id}' and answer is null;`,
    );
    const unasnwered = unansweredQuestions.all();
    if (unasnwered && unasnwered.length) {
      let remainingToAnswer = unasnwered.length;
      let i = 0;
      while (remainingToAnswer) {
        if (await getAnswer(message, unasnwered[i].id, unasnwered[i].question)) {
          i++;
          remainingToAnswer--;
        }
      }
      let addAQuestion = true;
      while (addAQuestion) {
        addAQuestion = await addQuestion(message);
      }
      return;
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
