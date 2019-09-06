import { Statement } from 'better-sqlite3';
import { CollectorFilter, GuildMember, Message, MessageOptions, Role, TextChannel, User } from 'discord.js';
import { ISassyBotImport, SassyBotCommand } from './sassybot';
import SassyDb from './SassyDb';

import * as moment from 'moment';
import { CoTMember } from './CoTMembers';
import Users from './Users';

const db = new SassyDb();
db.connection.exec(
  'CREATE TABLE IF NOT EXISTS user_absent (guild_id TEXT, user_id TEXT, name TEXT, start_date TEXT, end_date TEXT, timestamp INTEGER);',
);
db.connection.exec(
  'CREATE TABLE IF NOT EXISTS user_promote (guild_id TEXT, user_id TEXT, name TEXT, timestamp INTEGER);',
);

const addAbsent: Statement = db.connection.prepare(
  "INSERT INTO user_absent (guild_id, user_id, name, start_date, end_date, timestamp) VALUES (?,?,?,?,?,strftime('%s','now'));",
);
const addPromotion: Statement = db.connection.prepare(
  "INSERT INTO user_promote (guild_id, user_id, name, timestamp) VALUES (?,?,?,strftime('%s','now'));",
);

interface IAllAbsentsRow {
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  timestamp: string;
}
const getAllAbsents: Statement = db.connection.prepare(
  'SELECT user_id, name, start_date, end_date, timestamp FROM user_absent WHERE guild_id = ? ORDER BY name COLLATE NOCASE',
);

interface IAllPromotionsRow {
  user_id: string;
  name: string;
  timestamp: string;
}
const getAllPromotions: Statement = db.connection.prepare(
  'SELECT user_id, name, timestamp FROM user_promote WHERE guild_id = ? ORDER BY name COLLATE NOCASE',
);

interface IUserAbsentsRow {
  name: string;
  start_date: string;
  end_date: string;
  timestamp: string;
}
const getUserAbsent: Statement = db.connection.prepare(
  'SELECT name, start_date, end_date, timestamp FROM user_absent WHERE guild_id = ? AND user_id = ?',
);

interface IUserPromotionsRow {
  name: string;
  timestamp: string;
}
const getUserPromotions: Statement = db.connection.prepare(
  'SELECT name, timestamp FROM user_promote WHERE guild_id = ? AND user_id = ?',
);

const deleteUserAbsentRow: Statement = db.connection.prepare(
  'DELETE FROM user_absent WHERE guild_id = ? and user_id = ?',
);
const deleteUserPromotionRow: Statement = db.connection.prepare(
  'DELETE FROM user_promote WHERE guild_id = ? and user_id = ?',
);

let OFFICER_ROLE_ID: string = '';
const ONE_HOUR = 3600000;
const ACTIVE_SERVERS = [
  '324682549206974473', // Crown Of Thrones,
  '367724585019506688', // Sasner's Test Server,
];

const PROMOTION_ABSENT_CHANNEL_ID = '362037806178238464';

interface IRoleList {
  Member: Role | null;
  New: Role | null;
  Officer: Role | null;
  Recruit: Role | null;
  Verified: Role | null;
  Veteran: Role | null;
  [key: string]: Role | null;
}
const cotRoles: IRoleList = {
  Member: null,
  New: null,
  Officer: null,
  Recruit: null,
  Verified: null,
  Veteran: null,
};

const fetchCoTRoles: (member: GuildMember) => void = (member) => {
  const cot = member.guild;
  if (cot) {
    Object.keys(cotRoles).forEach((rank) => {
      if (cotRoles.hasOwnProperty(rank) && !cotRoles[rank]) {
        const cotRole = cot.roles.find((role) => role.name === rank);
        if (cotRole) {
          cotRoles[rank] = cotRole;
        }
      }
    });
  }
};

interface IActivityList {
  [key: string]:
    | {
        next: (message: Message, activityList: IActivityList) => Promise<void>;
        guildId: string;
        initDate: moment.Moment;
        name: string;
        startDate: moment.Moment;
        endDate: moment.Moment;
      }
    | undefined;
}
const entryPersistenceDuration = 5 * 60 * 1000;
const activePromotionList: IActivityList = {};
const activeAbsentList: IActivityList = {};

const maybeUpdateUserId = ({ name, userId }: { name: string; userId: string }) => {
  try {
    const members = CoTMember.findByName(name);
    if (members && members.length === 1) {
      const member = members[0];
      if (member.id !== userId) {
        return CoTMember.updateAPIUserId({ name, userId });
      }
    }
  } catch (err) {
    console.error({ context: 'Error Fetching Character', err });
  }
  return false;
};

function formatDate(d: moment.Moment) {
  return d.format('MMM Do YYYY');
}

// remove entry when it's more than 5 min old
setInterval(() => {
  const now = moment();
  [activeAbsentList, activePromotionList].forEach((activityList) => {
    Object.keys(activityList).forEach((key) => {
      const value = activityList[key];
      if (value) {
        const initDate = value.initDate;
        if (now.diff(initDate, 'minutes') > 5) {
          activityList[key] = undefined;
          delete activityList[key];
        }
      } else {
        activityList[key] = undefined;
        delete activityList[key];
      }
    });
  });
}, entryPersistenceDuration);

setInterval(() => {
  const yesterday = moment().subtract({ days: 1, hours: 12 });
  ACTIVE_SERVERS.forEach((serverId) => {
    const allAbsentRows: IAllAbsentsRow[] = getAllAbsents.all([serverId]);

    for (let i = 0, iMax = allAbsentRows.length; i < iMax; i++) {
      const endDate = moment(allAbsentRows[i].end_date, 'YYYY-MM-DD');
      if (endDate.isBefore(yesterday)) {
        deleteUserAbsentRow.run([serverId, allAbsentRows[i].user_id]);
      }
    }
  });
}, ONE_HOUR * 12);

const sassybotReply: (message: Message, reply: string) => Promise<void> = async (
  message: Message,
  reply: string,
): Promise<void> => {
  const options: MessageOptions = {
    disableEveryone: true,
    reply: message.author,
    split: true,
  };
  try {
    await message.channel.send(reply, options);
  } catch (e) {
    console.error(e);
  }
};

const sassybotRespond: (message: Message, text: string) => Promise<void> = async (
  message: Message,
  text: string,
): Promise<void> => {
  const options: MessageOptions = {
    disableEveryone: true,
    split: true,
  };
  try {
    await message.channel.send(text, options);
  } catch (e) {
    console.error(e);
  }
};

const getOfficerRoleId = (message: Message): string => {
  if (!OFFICER_ROLE_ID && message.guild && message.guild.roles) {
    const role = message.guild.roles.find((eachRole) => eachRole.name === 'Officer');
    if (role && role.id) {
      OFFICER_ROLE_ID = role.id;
    }
  }
  return OFFICER_ROLE_ID;
};

const isOfficer = (message: Message): boolean => {
  let officer = false;

  const officerId = getOfficerRoleId(message);
  if (officerId && message.member && message.member.roles) {
    officer = message.member.roles.has(officerId);
  }

  return officer;
};

const requestFFName = async (message: Message, activityList: IActivityList) => {
  activityList[message.author.id] = {
    endDate: moment.utc(0),
    guildId: message.guild.id,
    initDate: moment(),
    name: '',
    next: storeFFName,
    startDate: moment.utc(0),
  };
  await sassybotReply(message, 'First, Tell Me Your Full Character Name');
};

const requestStartDate = async (message: Message, activityList: IActivityList) => {
  activityList[message.author.id]!.next = storeStartDate;
  await sassybotReply(
    message,
    "What's the first day you'll be gone?\n(because i'm a dumb bot, please format it as YYYY-MM-DD)",
  );
};

const requestEndDate = async (message: Message, activityList: IActivityList) => {
  activityList[message.author.id]!.next = storeEndDate;
  await sassybotReply(
    message,
    "What day will you be back?\nIf you're not sure add a few days on the end\n(because i'm a dumb bot, please format it as YYYY-MM-DD)",
  );
};

const storeFFName = async (message: Message, activityList: IActivityList) => {
  const name = message.cleanContent.trim();
  maybeUpdateUserId({ name, userId: message.member.id });
  activityList[message.author.id]!.name = name;
  await sassybotReply(message, `ok i have your name as ${activityList[message.author.id]!.name}\n\n`);
  await requestStartDate(message, activityList);
};

const requestFFNameAndStop = async (message: Message, activityList: IActivityList) => {
  activityList[message.author.id] = {
    endDate: moment.utc(0),
    guildId: message.guild.id,
    initDate: moment(),
    name: '',
    next: storeFFNameAndStop,
    startDate: moment.utc(0),
  };
  await sassybotReply(
    message,
    'To request an officer verify your join date, and promote you: please tell me your full character name',
  );
};

const storeFFNameAndStop = async (message: Message, activityList: IActivityList) => {
  const name = message.cleanContent.trim();
  maybeUpdateUserId({ name, userId: message.member.id });
  activityList[message.author.id]!.name = name;
  await sassybotReply(message, `ok i have your name as ${activityList[message.author.id]!.name}\n\n`);
  await completePromotion(message, activityList);
};

const storeStartDate = async (message: Message, activityList: IActivityList) => {
  const possibleDate = message.cleanContent;
  if (moment(possibleDate, 'YYYY-MM-DD').isValid()) {
    activityList[message.author.id]!.startDate = moment(possibleDate, 'YYYY-MM-DD');
    const dateString = formatDate(activityList[message.author.id]!.startDate);
    await sassybotReply(message, `ok i have your start date as: ${dateString}\n\n`);
    await requestEndDate(message, activityList);
  } else {
    activityList[message.author.id]!.next = storeStartDate;
    await sassybotReply(message, 'Date Does Not Appear to be valid YYYY-MM-DD, please try again with that date format');
  }

  return;
};

const storeEndDate = async (message: Message, activityList: IActivityList) => {
  const possibleDate = message.cleanContent;
  if (moment(possibleDate, 'YYYY-MM-DD').isValid()) {
    activityList[message.author.id]!.endDate = moment(possibleDate, 'YYYY-MM-DD');
    const dateString = formatDate(activityList[message.author.id]!.endDate);
    await sassybotReply(message, `ok i have your end date as: ${dateString}\n\n`);
    await completeAbsent(message, activityList);
  } else {
    activityList[message.author.id]!.next = storeEndDate;
    await sassybotReply(message, 'Date Does Not Appear to be valid YYYY-MM-DD, please try again with that date format');
  }
  return;
};

const completeAbsent = async (message: Message, activityList: IActivityList) => {
  addAbsent.run([
    activityList[message.author.id]!.guildId,
    message.author.id,
    activityList[message.author.id]!.name,
    formatDate(activityList[message.author.id]!.startDate),
    formatDate(activityList[message.author.id]!.endDate),
  ]);

  const fetchedData: IUserAbsentsRow[] = getUserAbsent.all([
    activityList[message.author.id]!.guildId,
    message.author.id,
  ]);
  if (fetchedData.length) {
    await sassybotReply(
      message,
      `Ok Here is the information I have Stored:\nName:\t${fetchedData[0].name}\nStart Date:\t${fetchedData[0].start_date}\nEnd Date:\t${fetchedData[0].end_date}\n`,
    );
  } else {
    await sassybotReply(message, `Sorry something went terribly wrong, please try again, or message Sasner for help`);
  }
  activeAbsentList[message.author.id] = undefined;
  delete activeAbsentList[message.author.id];
};

const completePromotion = async (message: Message, activityList: IActivityList) => {
  addPromotion.run([
    activityList[message.author.id]!.guildId,
    message.author.id,
    activityList[message.author.id]!.name,
  ]);

  const fetchedData: IUserPromotionsRow[] = getUserPromotions.all([
    activityList[message.author.id]!.guildId,
    message.author.id,
  ]);
  if (fetchedData.length) {
    await sassybotReply(
      message,
      `Ok Here is the information I have Stored:\nName:\t${fetchedData[0].name}\n\nI'll Make Sure The Officers See Your Request!`,
    );
  } else {
    await sassybotReply(message, `Sorry something went terribly wrong, please try again, or message Sasner for help`);
  }
  activePromotionList[message.author.id] = undefined;
  delete activePromotionList[message.author.id];
};

const listAllAbsent = async (message: Message) => {
  const allAbsentRows: IAllAbsentsRow[] = getAllAbsents.all([message.guild.id]);

  if (allAbsentRows.length === 0) {
    await sassybotRespond(message, 'No Current Absentees');
  } else {
    let response: string = '';
    for (let i = 0, iMax = allAbsentRows.length; i < iMax; i++) {
      response += `${allAbsentRows[i].name} is gone from ${allAbsentRows[i].start_date} until ${allAbsentRows[i].end_date}\n`;
    }
    await sassybotRespond(message, response);
  }
};

const listAllPromotions = async (message: Message) => {
  fetchCoTRoles(message.member);
  const { Recruit, Member, Veteran } = cotRoles;
  const allPromotionsRows: IAllPromotionsRow[] = getAllPromotions.all([message.guild.id]);
  if (allPromotionsRows.length === 0) {
    await sassybotRespond(message, 'No Current Promotion Requests');
    return;
  }

  const options: MessageOptions = {
    disableEveryone: true,
    split: true,
  };
  const reactionFilter: CollectorFilter = (reaction, user: User): boolean => {
    return (reaction.emoji.name === 'no' || reaction.emoji.name === '✅') && user.id === message.author.id;
  };

  const responses: Array<{
    isMember: boolean;
    member: GuildMember;
    name: string;
    message: string;
    userId: string;
  }> = [];
  for (const promotionRow of allPromotionsRows) {
    const requestDate = moment(parseInt(promotionRow.timestamp, 10) * 1000);
    const user = await message.client.fetchUser(promotionRow.user_id);
    const member = await message.guild.fetchMember(user);
    let isMember = true;
    if (member && Member) {
      isMember = !!member.roles.find((r) => r.id === Member.id);
    }

    responses.push({
      isMember,
      member,
      message: `${promotionRow.name}\t\tRequested promotion to:\t${
        isMember ? 'Veteran' : 'Member'
      } (determined by discord rank) on\t${formatDate(requestDate)}\t\t\n`,
      name: promotionRow.name,
      userId: promotionRow.user_id,
    });
  }

  await message.channel.send('click the ✅ for yes, promote.\t\t <:no:344861453146259466> to deny promotion');
  await Promise.all(
    responses.map(async (response) => {
      const sentMessages = await message.channel.send(response.message, options);
      let msg: Message;
      if (Array.isArray(sentMessages)) {
        msg = sentMessages[sentMessages.length - 1];
      } else {
        msg = sentMessages;
      }

      const reactionYes = await msg.react('✅');
      const reactionNo = await msg.react('344861453146259466');
      let collection;
      try {
        collection = await msg.awaitReactions(reactionFilter, {
          max: 1,
          maxEmojis: 1,
          maxUsers: 1,
          time: ONE_HOUR * 2,
        }).catch(async () => {
          await Promise.all([reactionYes.remove(), reactionNo.remove()]).catch(console.error);
        });
        if (!collection || collection.size === 0) {
          await Promise.all([reactionYes.remove(), reactionNo.remove()]).catch(console.error);
          return;
        }
        if (collection.first() && collection.first().emoji.name === '✅') {
          const promoChannel = message.client.channels.find((channel) => channel.id === PROMOTION_ABSENT_CHANNEL_ID);
          let responseMessage = `${response.name} (${response.member.nickname}) your promotion has been approved`;
          try {
            CoTMember.promoteByName(response.name);
          } catch (err) {
            console.log({ context: 'error promoting member in local db', err });
          }
          if (Member) {
            if (response.isMember && Veteran) {
              await response.member.addRole(Veteran);
              await response.member.removeRole(Member);
              responseMessage += ' to Veteran';
            } else {
              await response.member.addRole(Member);
              if (Recruit) {
                await response.member.removeRole(Recruit);
              }
              responseMessage += ' to Member';
            }
          }
          if (promoChannel instanceof TextChannel) {
            await promoChannel.send(responseMessage);
          }
          deleteUserPromotionRow.run([message.guild.id, response.userId]);
          await msg.delete(100);
        } else if (collection.first().emoji.name === 'no') {
          await sassybotRespond(msg, `Please Remember To Flow Up With ${response.name} On Why They Were Denied`);
          deleteUserPromotionRow.run([message.guild.id, response.userId]);
          await msg.delete(100);
        }
      } catch (e) {
        console.error({ e });
        await Promise.all([reactionYes.remove(), reactionNo.remove()]).catch(console.error);
      }
    }),
  );
};

const useMemberName = async (message: Message, activityList: IActivityList, cotmember: CoTMember): Promise<void> => {
  await sassybotReply(message, `I have your name as: ${cotmember.name}, if that's not right please contact Sasner to have it changed (functionality pending)`);
  activityList[message.author.id] = {
    endDate: moment.utc(0),
    guildId: message.guild.id,
    initDate: moment(),
    name: cotmember.name,
    next: storeFFName,
    startDate: moment.utc(0),
  };
  await requestStartDate(message, activityList);
};

const useMemberNameAndStop = async (message: Message, activityList: IActivityList, cotmember: CoTMember): Promise<void> => {
  await sassybotReply(message, `I have your name as: ${cotmember.name}, if that's not right please contact Sasner to have it changed (functionality pending)`);
  activityList[message.author.id] = {
    endDate: moment.utc(0),
    guildId: message.guild.id,
    initDate: moment(),
    name: cotmember.name,
    next: storeFFName,
    startDate: moment.utc(0),
  };
  await completePromotion(message, activityList);
};

const absentFunction: SassyBotCommand = async (message: Message) => {
  if (isOfficer(message) || message.author.id === Users.Sasner.id) {
    await listAllAbsent(message);
  } else {
    if (activeAbsentList[message.author.id]) {
      await activeAbsentList[message.author.id]!.next(message, activeAbsentList);
    } else {
      let member: false | CoTMember = false;
      try {
        member = CoTMember.fetchMember(message.member.id);
      } catch (err) {
        console.error({err})
      }
      if (member) {
        await useMemberName(message, activeAbsentList, member);
      } else {
        await requestFFName(message, activeAbsentList);
      }
    }
  }
};

const promotionFunction: SassyBotCommand = async (message: Message) => {
  if (isOfficer(message) || message.author.id === Users.Sasner.id) {
    await listAllPromotions(message);
  } else {
    if (activePromotionList[message.author.id]) {
      await activePromotionList[message.author.id]!.next(message, activePromotionList);
    } else {
      let member: false | CoTMember = false;
      try {
        member = CoTMember.fetchMember(message.member.id);
      } catch (err) {
        console.error({err})
      }
      if (member) {
        await useMemberNameAndStop(message, activeAbsentList, member);
      } else {
        await requestFFNameAndStop(message, activePromotionList);
      }
    }
  }
};

const resumeCommand: (message: Message) => boolean = (message: Message) => {
  if (activeAbsentList.hasOwnProperty(message.author.id) && activeAbsentList[message.author.id]) {
    absentFunction(message);
    return true;
  } else if (activePromotionList.hasOwnProperty(message.author.id) && activePromotionList[message.author.id]) {
    promotionFunction(message);
    return true;
  } else {
    return false;
  }
};

export let AbsentOrPromoteFunctions: ISassyBotImport = {
  functions: {
    absent: absentFunction,
    promote: promotionFunction,
  },
  help: {
    absent: 'usage: `!{sassybot|sb} absent` -- something something something',
    promote: 'usage: `!{sassybot|sb} promotion` -- something something something',
  },
};

export function resumeAbsentOrPromote(message: Message): boolean {
  return resumeCommand(message);
}
