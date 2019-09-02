import { Statement } from 'better-sqlite3';
import { CollectorFilter, GuildMember, Message, MessageOptions, Role, TextChannel, User } from 'discord.js';
import { ISassyBotImport, SassyBotCommand } from './sassybot';
import SassyDb from './SassyDb';

import * as moment from 'moment';
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
        next: (message: Message, activityList: IActivityList) => void;
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

const sassybotReply: (message: Message, reply: string) => void = (message: Message, reply: string): void => {
  const options: MessageOptions = {
    disableEveryone: true,
    reply: message.author,
    split: true,
  };
  message.channel.send(reply, options);
};

const sassybotRespond: (message: Message, reply: string) => void = (message: Message, text: string): void => {
  const options: MessageOptions = {
    disableEveryone: true,
    split: true,
  };
  message.channel.send(text, options).catch(console.error);
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

const requestFFName = (message: Message, activityList: IActivityList) => {
  activityList[message.author.id] = {
    endDate: new Date(0),
    guildId: message.guild.id,
    initDate: moment(),
    startDate: moment.utc(0),
    endDate: moment.utc(0),
    name: ''
  };
  sassybotReply(message, 'First, Tell Me Your Full Character Name');
};

const requestStartDate = (message: Message, activityList: IActivityList) => {
  activityList[message.author.id]!.next = storeStartDate;
  sassybotReply(
    message,
    "What's the first day you'll be gone?\n(because i'm a dumb bot, please format it as YYYY-MM-DD)",
  );
};

const requestEndDate = (message: Message, activityList: IActivityList) => {
  activityList[message.author.id]!.next = storeEndDate;
  sassybotReply(
    message,
    "What day will you be back?\nIf you're not sure add a few days on the end\n(because i'm a dumb bot, please format it as YYYY-MM-DD)",
  );
};

const storeFFName = (message: Message, activityList: IActivityList) => {
  activityList[message.author.id]!.name = message.cleanContent;
  sassybotReply(message, `ok i have your name as ${activityList[message.author.id]!.name}\n\n`);
  requestStartDate(message, activityList);
};

const requestFFNameAndStop = (message: Message, activityList: IActivityList) => {
  activityList[message.author.id] = {
    endDate: new Date(0),
    guildId: message.guild.id,
    initDate: moment(),
    startDate: moment.utc(0),
    endDate: moment.utc(0),
    name: ''
  };
  sassybotReply(
    message,
    'To request an officer verify your join date, and promote you: please tell me your full character name',
  );
};

const storeFFNameAndStop = (message: Message, activityList: IActivityList) => {
  activityList[message.author.id]!.name = message.cleanContent;
  sassybotReply(message, `ok i have your name as ${activityList[message.author.id]!.name}\n\n`);
  completePromotion(message, activityList);
};

const storeStartDate = (message: Message, activityList: IActivityList) => {
  const possibleDate = message.cleanContent;
  if (moment(possibleDate, 'YYYY-MM-DD').isValid()) {
    activityList[message.author.id]!.startDate = moment(
      possibleDate,
      'YYYY-MM-DD'
    );
    const dateString = formatDate(activityList[message.author.id]!.startDate);
    sassybotReply(message, `ok i have your start date as: ${dateString}\n\n`);
    requestEndDate(message, activityList);
  } else {
    activityList[message.author.id]!.next = storeStartDate;
    sassybotReply(message, 'Date Does Not Appear to be valid YYYY-MM-DD, please try again with that date format');
  }

  return;
};

const storeEndDate = (message: Message, activityList: IActivityList) => {
  const possibleDate = message.cleanContent;
  if (moment( possibleDate, 'YYYY-MM-DD').isValid()) {
    activityList[message.author.id]!.endDate = moment(
      possibleDate,
      'YYYY-MM-DD'
    );
    const dateString = formatDate(activityList[message.author.id]!.endDate);
    sassybotReply(
      message,
      `ok i have your end date as: ${dateString}\n\n`,
    );
    completeAbsent(message, activityList);
  } else {
    activityList[message.author.id]!.next = storeEndDate;
    sassybotReply(message, 'Date Does Not Appear to be valid YYYY-MM-DD, please try again with that date format');
  }
  return;
};

const completeAbsent = (message: Message, activityList: IActivityList) => {
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
    sassybotReply(
      message,
      `Ok Here is the information I have Stored:\nName:\t${fetchedData[0].name}\nStart Date:\t${fetchedData[0].start_date}\nEnd Date:\t${fetchedData[0].end_date}\n`,
    );
  } else {
    sassybotReply(message, `Sorry something went terribly wrong, please try again, or message Sasner for help`);
  }
  activeAbsentList[message.author.id] = undefined;
  delete activeAbsentList[message.author.id];
};

const completePromotion = (message: Message, activityList: IActivityList) => {
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
    sassybotReply(
      message,
      `Ok Here is the information I have Stored:\nName:\t${fetchedData[0].name}\n\nI'll Make Sure The Officers See Your Request!`,
    );
  } else {
    sassybotReply(message, `Sorry something went terribly wrong, please try again, or message Sasner for help`);
  }
  activePromotionList[message.author.id] = undefined;
  delete activePromotionList[message.author.id];
};

const listAllAbsent = (message: Message) => {
  const allAbsentRows: IAllAbsentsRow[] = getAllAbsents.all([message.guild.id]);

  if (allAbsentRows.length === 0) {
    sassybotRespond(message, 'No Current Absentees');
  } else {
    let response: string = '';
    for (let i = 0, iMax = allAbsentRows.length; i < iMax; i++) {
      response += `${allAbsentRows[i].name} is gone from ${allAbsentRows[i].start_date} until ${allAbsentRows[i].end_date}\n`;
    }
    sassybotRespond(message, response);
  }
};

const listAllPromotions = (message: Message) => {
  fetchCoTRoles(message.member);
  const { Recruit, Member, Veteran } = cotRoles;
  const allPromotionsRows: IAllPromotionsRow[] = getAllPromotions.all([message.guild.id]);

  if (allPromotionsRows.length === 0) {
    sassybotRespond(message, 'No Current Promotion Requests');
  } else {
    const responses: Array<{
      isMember: boolean;
      member: GuildMember;
      name: string;
      message: string;
      userId: string;
    }> = [];
    for (let i = 0, iMax = allPromotionsRows.length; i < iMax; i++) {
      const requestDate = moment(parseInt(allPromotionsRows[i].timestamp, 10));
      const member = message.guild.member(allPromotionsRows[i].user_id);
      let isMember = true;
      if (Member) {
        isMember = !!member.roles.find((r) => r.id === Member.id);
      }
      responses.push({
        isMember,
        member,
        message: `${i + 1}:\t${allPromotionsRows[i].name}\t\tRequested promotion to:\t${
          isMember ? 'Veteran' : 'Member'
        } (determined by discord rank) on\t${requestDate.toDateString()}\t\t\n`,
        name: allPromotionsRows[i].name,
        userId: allPromotionsRows[i].user_id,
        message: `${i + 1}:\t${
          allPromotionsRows[i].name
        }\t\tRequested promotion to:\t${
          isMember ? 'Veteran' : 'Member'
        } (determined by discord rank) on\t${formatDate(requestDate)}\t\t\n`
      });
    }

    const options: MessageOptions = {
      disableEveryone: true,
      split: true,
    };

    const reactionFilter: CollectorFilter = (reaction, user: User): boolean => {
      return (reaction.emoji.name === 'no' || reaction.emoji.name === '✅') && user.id === message.author.id;
    };

    message.channel.send('click the ✅ for yes, promote.\t\t <:no:344861453146259466> to deny promotion');
    responses.forEach((response) => {
      message.channel
        .send(response.message, options)
        .then((sentMessages) => {
          if (!Array.isArray(sentMessages)) {
            sentMessages = [sentMessages];
          }
          sentMessages.forEach((msg) => {
            msg.react('✅').then(() => {
              msg
                .react('344861453146259466')
                .then((reaction) => {
                  msg
                    .awaitReactions(reactionFilter, {
                      max: 1,
                      maxEmojis: 1,
                      maxUsers: 1,
                      time: ONE_HOUR * 2,
                    })
                    .then((collection) => {
                      if (collection.size === 0) {
                        reaction.remove().catch(console.error);
                        return;
                      }
                      if (collection.size > 0) {
                        console.log({ collection });
                        if (collection.first().emoji.name === '✅') {
                          const promoChannel = message.client.channels.find(
                            (channel) => channel.id === PROMOTION_ABSENT_CHANNEL_ID,
                          );
                          let responseMessage = `${response.name} (${response.member.nickname}) your promotion has been approved`;
                          if (Member) {
                            if (response.isMember && Veteran) {
                              response.member.addRole(Veteran);
                              response.member.removeRole(Member);
                              responseMessage += ' to Veteran';
                            } else {
                              response.member.addRole(Member);
                              if (Recruit) {
                                response.member.removeRole(Recruit);
                              }
                              responseMessage += ' to Member';
                            }
                          }
                          if (promoChannel instanceof TextChannel) {
                            promoChannel.send(responseMessage);
                          }
                        } else if (collection.first().emoji.name === 'no') {
                          sassybotRespond(
                            msg,
                            `Please Remember To Flow Up With ${response.name} On Why They Were Denied`,
                          );
                        } else {
                          sassybotRespond(
                            msg,
                            'I have no idea how you got to this chunk of code, please ping Sasner to get Sassybot unfucked',
                          );
                        }
                        deleteUserPromotionRow.run([message.guild.id, response.userId]);
                        msg.delete(100);
                      }
                    })
                    .catch(() => {
                      reaction.remove().catch(console.error);
                    });
                })
                .catch(console.error);
            });
          });
        })
        .catch(console.error);
    });
  }
};

const absentFunction: SassyBotCommand = (message: Message) => {
  if (isOfficer(message) || message.author.id === Users.Sasner.id) {
    return listAllAbsent(message);
  } else {
    if (activeAbsentList[message.author.id]) {
      activeAbsentList[message.author.id]!.next(message, activeAbsentList);
    } else {
      return requestFFName(message, activeAbsentList);
    }
  }
};

const promotionFunction: SassyBotCommand = (message: Message) => {
  if (isOfficer(message) || message.author.id === Users.Sasner.id) {
    return listAllPromotions(message);
  } else {
    if (activePromotionList[message.author.id]) {
      activePromotionList[message.author.id]!.next(message, activePromotionList);
    } else {
      return requestFFNameAndStop(message, activePromotionList);
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
