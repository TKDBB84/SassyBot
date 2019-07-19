import {Message, MessageOptions} from "discord.js";
import {SassyBotCommand, SassyBotImport} from "./sassybot";
import SassyDb from './SassyDb'
import {Statement} from "better-sqlite3";

const db = new SassyDb();
db.connection.exec(
    'CREATE TABLE IF NOT EXISTS user_absent (guild_id TEXT, user_id TEXT, name TEXT, start_date TEXT, end_date TEXT, timestamp INTEGER);'
);
db.connection.exec(
    'CREATE TABLE IF NOT EXISTS user_promote (guild_id TEXT, user_id TEXT, name TEXT, timestamp INTEGER);'
);

const addAbsent: Statement = db.connection.prepare(
    "INSERT INTO user_absent (guild_id, user_id, name, start_date, end_date, timestamp) VALUES (?,?,?,?,?,strftime('%s','now'));"
);
const addPromotion: Statement = db.connection.prepare(
    "INSERT INTO user_promote (guild_id, user_id, name, timestamp) VALUES (?,?,?,strftime('%s','now'));"
);

type allAbsentsRow = {user_id: string, name: string, start_date: string, end_date: string, timestamp: string}
const getAllAbsents: Statement = db.connection.prepare(
    'SELECT user_id, name, start_date, end_date, timestamp FROM user_absent WHERE guild_id = ?'
);

type allPromotionsRow = {user_id: string, name: string, timestamp: string}
const getAllPromotions: Statement = db.connection.prepare(
    'SELECT user_id, name, timestamp FROM user_promote WHERE guild_id = ?'
);

type userAbsentsRow = {name: string, start_date: string, end_date: string, timestamp: string}
const getUserAbsent: Statement = db.connection.prepare(
    'SELECT name, start_date, end_date, timestamp FROM user_absent WHERE guild_id = ? AND user_id = ?'
);

type userPromotionsRow = {name: string, timestamp: string}
const getUserPromotions: Statement = db.connection.prepare(
    'SELECT name, timestamp FROM user_promote WHERE guild_id = ? AND user_id = ?'
);

const deleteUserAbsentRow: Statement = db.connection.prepare(
    'DELETE FROM user_absent WHERE guild_id = ? and user_id = ?'
);

const ONE_HOUR = 3600000;
const ACTIVE_SERVERS = [
    '324682549206974473', // Crown Of Thrones,
    '367724585019506688', // Sasner's Test Server,
];

type activityList = {
    [key: string]: {
        next: (message: Message, activityList: activityList) => void,
        guildId: string,
        initDate: Date,
        name: string,
        startDate: Date,
        endDate: Date,
    }
};
                              // 5 is number of min
const entryPersistenceDuration = 5 * 60 * 1000;
const activePromotionList: activityList = {};
const activeAbsentList: activityList = {};

function formatDate(d: Date) {
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    let year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}
// remove entry when it's more than 5 min old
setInterval(() => {
    Object.keys(activeAbsentList).forEach((key) => {
        const fiveMinAfterStart = activeAbsentList[key].initDate.getTime() + entryPersistenceDuration;
        if (fiveMinAfterStart < Date.now()) {
            delete activeAbsentList[key]
        }
    });

    Object.keys(activePromotionList).forEach((key) => {
        const fiveMinAfterStart = activeAbsentList[key].initDate.getTime() + entryPersistenceDuration;
        if (fiveMinAfterStart < Date.now()) {
            delete activeAbsentList[key]
        }
    })
}, entryPersistenceDuration);

setInterval(() => {
    const currentDate = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(currentDate.getDate()+1);
    ACTIVE_SERVERS.forEach((serverId) => {
        const allAbsentRows: allAbsentsRow[] = getAllAbsents.all([
            serverId,
        ]);

        for (let i = 0, iMax = allAbsentRows.length; i < iMax; i++) {
            const [year, month, day] = allAbsentRows[i].end_date.split("-").map(i => parseInt(i, 10));
            const endDate = new Date(year, month - 1, day, 0, 0, 0, 0);
            if (endDate < tomorrow) {
                deleteUserAbsentRow.run([
                    serverId,
                    allAbsentRows[i].user_id
                ])
            }
        }

    });
}, ONE_HOUR * 12);


const sassybotPrivateReply: (message: Message, reply: string) => void = (message: Message, reply: string): void => {
    const options: MessageOptions = {
        disableEveryone: true,
        split: true,
    };
    message.author.send(reply, options)
};


const requestFFName = (message: Message, activityList: activityList) => {
    activityList[message.author.id] = {
        next: storeFFName,
        guildId: message.guild.id,
        initDate: new Date(),
        startDate: new Date(0),
        endDate: new Date(0),
        name: '',
    };
    sassybotPrivateReply(message, 'First, Tell Me Your Full Character Name')
};

const requestStartDate = (message: Message, activityList: activityList) => {
    activityList[message.author.id].next = storeStartDate;
    sassybotPrivateReply(message, "Whats the first day you'll be gone?\n(because i'm a dumb bot, please format it as YYYY-MM-DD)")
};

const requestEndDate = (message: Message, activityList: activityList) => {
    activityList[message.author.id].next = storeEndDate;
    sassybotPrivateReply(message, "What day will you be back?\nIf your not sure add a few days on the end\n(because i'm a dumb bot, please format it as YYYY-MM-DD)")
};

const storeFFName = (message: Message, activityList: activityList) => {
    activityList[message.author.id].name = message.cleanContent;
    sassybotPrivateReply(message, `ok i have your name as ${activityList[message.author.id].name}`);
    requestStartDate(message, activityList);
};

const storeStartDate = (message: Message, activityList: activityList) => {
    const possibleDate = message.cleanContent;
    const [year, month, day] = possibleDate.split("-").map(i => parseInt(i, 10));


    if (day && month && year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        activityList[message.author.id].startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        const dateString = activityList[message.author.id].startDate.toDateString();
        sassybotPrivateReply(message, `ok i have your start date as: ${dateString}`);
        requestEndDate(message, activityList)
    } else {
        activityList[message.author.id].next = storeStartDate;
        sassybotPrivateReply(message, 'Date Does Not Appear to be valid YYYY-MM-DD, please try again with that date format')
    }

    return
};

const storeEndDate = (message: Message, activityList: activityList) => {
    const possibleDate = message.cleanContent;
    const [year, month, day] = possibleDate.split("-").map(i => parseInt(i, 10));
    const error = !day || !month || !year || month < 1 || month > 12 || day < 1 || day > 31;

    if (!error) {
        activityList[message.author.id].endDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        sassybotPrivateReply(message, `ok i have your end date as: ${activityList[message.author.id].endDate.toDateString()}`);
        completeAbsent(message, activityList)
    } else {
        activityList[message.author.id].next = storeStartDate;
        sassybotPrivateReply(message, 'Date Does Not Appear to be valid YYYY-MM-DD, please try again with that date format')
    }
    return
};

const completeAbsent = (message: Message, activityList: activityList) => {
    addAbsent.run([
        activityList[message.author.id].guildId,
        message.author.id,
        activityList[message.author.id].name,
        formatDate(activityList[message.author.id].startDate),
        formatDate(activityList[message.author.id].endDate),
    ]);

    const fetchedData: userAbsentsRow[] = getUserAbsent.all([activityList[message.author.id].guildId, message.author.id]);
    if (fetchedData.length) {
        sassybotPrivateReply(message, `Ok Here is the information I have Stored:\nName:\t${fetchedData[0].name}\nStart Date:\t${fetchedData[0].start_date}\nEnd Date:\t${fetchedData[0].end_date}`);
    } else {
        sassybotPrivateReply(message, `Sorry something went terribly wrong, please try again, or message Sasner for help`);
    }
    delete activeAbsentList[message.author.id];
};

const absentFunction: SassyBotCommand = (message: Message) => {
    if (activeAbsentList[message.author.id]) {
        activeAbsentList[message.author.id].next(message, activeAbsentList);
    }else {
        return requestFFName(message, activeAbsentList);
    }
};

const promotionFunction: SassyBotCommand = (message: Message) => {
    sassybotPrivateReply(message, 'sasner is shit and hasn\'t dont this yet, so use !sb absent for now');
    return;
    // if (activePromotionList[message.author.id]) {
    //     activePromotionList[message.author.id].next(message, activePromotionList);
    // } else {
    //     return requestFFName(message, activePromotionList);
    // }
};

const resumeCommand: SassyBotCommand = (message: Message) => {
    if (activeAbsentList.hasOwnProperty(message.author.id)) {
        absentFunction(message);
    } else if (activePromotionList.hasOwnProperty(message.author.id)) {
        promotionFunction(message);
    } else {
        sassybotPrivateReply(message, 'Hi, sorry I\'m not sure what you\'re looking for from me.\n\nIf you were using a `!sb absent` or `!sb promote` you probably didn\'t finish quick enough, please start again');
    }
};

export let AbsentOrPromoteFunctions: SassyBotImport = {
    functions: {
        absent: absentFunction,
        promote: promotionFunction
    },
    help: {
        absent:
            'usage: `!{sassybot|sb} absent` -- something something something',
        promote:
            "usage: `!{sassybot|sb} promotion` -- something something something"
    }
};

export function resumeAbsentOrPromote(message: Message) { resumeCommand(message); }