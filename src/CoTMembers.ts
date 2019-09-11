import { GuildMember, Message, MessageOptions, Role } from 'discord.js';
import * as fs from 'fs';
import * as http2 from 'http2';
import * as moment from 'moment';
import { ISassyBotImport } from './sassybot';
import SassyDb from './SassyDb';
import { User } from './Users';

interface IMemberRow {
  user_id: string;
  name: string;
  rank: string;
  first_seen_discord: number;
  last_promotion: number | string;
}

interface IRoleList {
  [key: string]: Role | null;
}

const ONE_HOUR = 3600000;

export interface IFreeCompanyMember {
  Avatar: 'https://img2.finalfantasyxiv.com/f/9bb002c4984cb609a79dd28c4079c5d4_ce736afe35e2ded4e46c4fd0659aef7efc0_96x96.jpg';
  FeastMatches: number;
  ID: number;
  Name: string;
  Rank: string;
  RankIcon: string;
  Server: string;
}

interface IClientSecrets {
  token: string;
  xivApiToken: string;
}

const db = new SassyDb();
db.connection.exec(
  'CREATE TABLE IF NOT EXISTS cot_promotion_tracking (user_id TEXT PRIMARY KEY, name TEXT, rank TEXT, first_seen_discord TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_promotion TIMESTAMP);',
);

db.connection.exec(
  'CREATE TABLE IF NOT EXISTS cot_members (api_id TEXT PRIMARY KEY, user_id TEXT, name TEXT, rank TEXT, first_seen_api TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_seen_api TIMESTAMP DEFAULT CURRENT_TIMESTAMP);',
);

interface IAllAbsentsRow {
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  timestamp: string;
}
const getAllAbsents = (guildId: string): IAllAbsentsRow[] => {
  const stmtGetAllAbsents = db.connection.prepare(
    'SELECT user_id, name, timestamp FROM user_promote WHERE guild_id = ? ORDER BY name COLLATE NOCASE',
  );
  return stmtGetAllAbsents.all([guildId]);
};

interface IAllPromotionsRow {
  user_id: string;
  name: string;
  timestamp: string;
}
const getAllPromotions = (guildId: string): IAllPromotionsRow[] => {
  const stmtGetAllPromotions = db.connection.prepare(
    'SELECT user_id, name, timestamp FROM user_promote WHERE guild_id = ? ORDER BY name COLLATE NOCASE',
  );
  return stmtGetAllPromotions.all([guildId]);
};

const getMostRecentPull = () => {
  const stmt = db.connection.prepare('SELECT MAX(last_seen_api) as max_last from cot_members;');
  const data = stmt.get();
  return data.max_last;
};

export const firstApiPull = moment('2019-09-02 22:30:00');

export function fetchCoTRoles(member: GuildMember): IRoleList {
  const cotRoles: IRoleList = {
    Member: null,
    New: null,
    Officer: null,
    Recruit: null,
    Verified: null,
    Veteran: null,
  };
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
  return cotRoles;
}

export interface ICotMemberRoW {
  api_id: string;
  user_id: string;
  name: string;
  rank: string;
  first_seen_api: number;
  last_seen_api: number;
}
type getAPIUserByNameFunction = ({ name }: { name: string }) => ICotMemberRoW[];
const getAPIUserByName: getAPIUserByNameFunction = ({ name }) => {
  const stmtGetUserByName = db.connection.prepare('SELECT * FROM cot_members WHERE name = ? COLLATE NOCASE');
  return stmtGetUserByName.all([name]);
};

type getAPIUserByUserId = ({ id }: { id: string }) => ICotMemberRoW[];
export const getAPIUserByUserId: getAPIUserByUserId = ({ id }) => {
  const stmtGetUserByName = db.connection.prepare('SELECT * FROM cot_members WHERE user_id = ?');
  return stmtGetUserByName.all([id]);
};

type upsertMemberFunction = ({ ID, Name, Rank }: IFreeCompanyMember) => boolean;
const upsertMember: upsertMemberFunction = ({ ID, Name, Rank }) => {
  const stmtUpsertMember = db.connection.prepare(
    "INSERT INTO cot_members (api_id, user_id, name, rank) VALUES (?, '', ?, ?) ON CONFLICT(api_id) DO UPDATE SET rank = ?, last_seen_api = CURRENT_TIMESTAMP",
  );
  const result = stmtUpsertMember.run([ID, Name, Rank, Rank]);
  return !!result.lastInsertRowid || !!result.changes;
};

type updateUserIdByNameFunction = ({ name, id }: { name: string; id: string }) => boolean;
const updateAPIUserId: updateUserIdByNameFunction = ({ name, id }) => {
  const stmtUpdateUserIdByName = db.connection.prepare(
    'UPDATE cot_members SET user_id = ? WHERE name = ? COLLATE NOCASE',
  );
  const result = stmtUpdateUserIdByName.run([id, name]);
  return !!result.changes;
};

const updateAPIUserIdIfNotSet: updateUserIdByNameFunction = ({ name, id }) => {
  const updateAPIUserIdIfNotSetStmt = db.connection.prepare(
    "UPDATE cot_members SET user_id = ? WHERE (user_id is null OR user_id = '') AND name = ? COLLATE NOCASE",
  );
  const result = updateAPIUserIdIfNotSetStmt.run([id, name]);
  return !!result.changes;
};

const getSecrets: () => IClientSecrets = (): IClientSecrets => ({
  token: process.env.DISCORD_TOKEN as string,
  xivApiToken: process.env.XIV_API_TOKEN as string,
});

const getLatestMemberList = (): Promise<IFreeCompanyMember[]> => {
  return new Promise((resolve) => {
    const client = http2.connect('https://xivapi.com:443');
    client.on('error', console.error);
    const req = client.request({
      ':path': `/freecompany/9229001536389012456?private_key=${getSecrets().xivApiToken}&data=FCM`,
    });
    req.setEncoding('utf8');
    let responseBody = '';
    req.on('data', (chunk) => {
      responseBody += chunk;
    });
    req.on('end', () => {
      let finalResult: IFreeCompanyMember[] = [];
      try {
        const parsedBody = JSON.parse(responseBody);
        if (parsedBody.hasOwnProperty('FreeCompanyMembers')) {
          finalResult = parsedBody.FreeCompanyMembers;
        }
      } catch (err) {
        console.error({ context: 'Error From XIVAPI', err });
        finalResult = [];
      }
      client.close(() => {
        resolve(finalResult);
      });
    });
    req.end();
  });
};

const matchMemberByName = (member: IFreeCompanyMember) => {
  const cotMemberRows = getMemberByName({ name: member.Name });
  if (cotMemberRows.length === 1) {
    const cotMember = cotMemberRows[0];
    try {
      updateAPIUserIdIfNotSet({ name: member.Name, id: cotMember.user_id });
    } catch (e) {
      console.error('error claiming user: ', { name: member.Name, id: cotMember.user_id });
      return false;
    }
  } else {
    return false;
  }
  return true;
};

const updateAllMemberRecords = async () => {
  const currentMembers = await getLatestMemberList();
  mapPromotionAndAbsentRows();
  currentMembers.map((member) => {
    upsertMember(member);
    matchMemberByName(member);
  });
};

function mapPromotionAndAbsentRows() {
  const COT_GUILD_ID = '324682549206974473';
  [ ...getAllPromotions(COT_GUILD_ID), ...getAllAbsents(COT_GUILD_ID)].map((row) => {
    updateAPIUserIdIfNotSet({ name: row.name, id: row.user_id });
  });
}
setInterval(updateAllMemberRecords, ONE_HOUR * 12);

type AddMemberFunction = ({ id, name, rank }: { id: string; name: string; rank: string }) => boolean;
const addMember: AddMemberFunction = ({ id, name, rank }) => {
  const member = db.connection.prepare('INSERT INTO cot_promotion_tracking (user_id, name, rank) VALUES (?, ?, ?)');
  const result = member.run([id, name, rank]);
  return !!result.lastInsertRowid;
};

export const getLastPromotionByUserId = ({ id }: { id: string }): string => {
  const getLastPromotionStmt = db.connection.prepare(
    "SELECT coalesce(last_promotion, '') as last_promotion FROM cot_promotion_tracking WHERE user_id = ?",
  );
  const result = getLastPromotionStmt.all([id]);
  if (result && result.length === 1) {
    return result[0].last_promotion;
  }
  return '';
};

type getMemberByNameFunction = ({ name }: { name: string }) => IMemberRow[];
const getMemberByName: getMemberByNameFunction = ({ name }) => {
  const memberByName = db.connection.prepare('SELECT * FROM cot_promotion_tracking WHERE name = ? COLLATE NOCASE');
  return memberByName.all([name]);
};

type getMemberByIdFunction = ({ id }: { id: string }) => IMemberRow;
const getMemberByUserId: getMemberByIdFunction = ({ id }) => {
  const memberByUserId = db.connection.prepare('SELECT * FROM cot_promotion_tracking where user_id = ?');
  return memberByUserId.get([id]);
};

type promoteMember = ({ id, rank }: { id: string; rank: string }) => boolean;
const promoteByMember: promoteMember = ({ id, rank }) => {
  const memberByUserId = db.connection.prepare(
    'UPDATE cot_promotion_tracking SET last_promotion = CURRENT_TIMESTAMP, rank = ? WHERE user_id = ?',
  );
  const result = memberByUserId.run([rank, id]);
  return !!result.changes;
};

const setRankInTRackingById: promoteMember = ({ id, rank }) => {
  const memberByUserId = db.connection.prepare('UPDATE cot_promotion_tracking SET rank = ? WHERE user_id = ?');
  const result = memberByUserId.run([rank, id]);
  return !!result.changes;
};

export class CoTMember extends User {
  public static fetchMember(userId: string): CoTMember | false {
    const row: IMemberRow = getMemberByUserId({ id: userId });
    if (!row) {
      return false;
    }
    const member = new CoTMember(row.user_id, row.name, row.rank);
    const apiUserRow = getAPIUserByUserId({ id: row.user_id });
    if (apiUserRow && apiUserRow.length === 1) {
      member.firstSeenAPI = moment(apiUserRow[0].first_seen_api);
    }
    return member;
  }

  public static findByName(name: string): CoTMember[] | false {
    const matchingRows: IMemberRow[] = getMemberByName({ name });
    if (!matchingRows) {
      return false;
    }
    const results: CoTMember[] = [];
    matchingRows.forEach((row) => {
      results.push(new CoTMember(row.user_id, row.name, row.rank));
    });
    return results;
  }

  public static promoteByName(name: string): CoTMember | false {
    const members = this.findByName(name);
    if (members && members.length === 1) {
      members[0].promote();
      return members[0];
    }
    return false;
  }

  public static getMemberFromAPIByName({ name, userId }: { name: string; userId: string }): CoTMember | false {
    const row = getAPIUserByName({ name });
    if (row.length === 1) {
      return new CoTMember(userId, row[0].name, row[0].rank);
    }
    return false;
  }

  public static updateAPIUserId({ name, userId }: { name: string; userId: string }): boolean {
    return updateAPIUserId({ name, id: userId });
  }

  public name: string = '';
  public rank: string = '';
  public firstSeenDiscord: string = '';
  public lastPromotion: string = '';
  public firstSeenAPI: moment.Moment = moment.utc(0);

  public constructor(id: string, name: string = '', rank: string = 'Recruit') {
    super(id);
    this.name = name;
    this.rank = rank === '' ? 'Recruit' : rank;
  }

  public addMember(): boolean {
    if (!this.id) {
      return false;
    }
    const exists: IMemberRow = getMemberByUserId({ id: this.id });
    if (exists && exists.user_id) {
      return true;
    }
    addMember({ id: this.id, name: this.name, rank: this.rank });
    updateAPIUserIdIfNotSet({ name: this.name, id: this.id });
    return true;
  }

  public setRank(): boolean {
    return setRankInTRackingById({ id: this.id, rank: this.rank });
  }

  public promote(): boolean {
    switch (this.rank.toLowerCase()) {
      case 'new':
        this.rank = 'Recruit';
        break;
      case 'member':
        this.rank = 'Veteran';
        break;
      case 'recruit':
      default:
        this.rank = 'Member';
    }
    return promoteByMember({ id: this.id, rank: this.rank });
  }
}

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

const claimUser = async (message: Message) => {
  const cotRoles = fetchCoTRoles(message.member);
  const parsed = message.content.split('!sb claim ');
  const id = message.member.id;
  const memberByUserId = CoTMember.fetchMember(id);
  if (memberByUserId) {
    await sassybotRespond(
      message,
      `I already have you as: ${memberByUserId.name}, if this isn't correct, please contact Sasner`,
    );
    return;
  }
  if (parsed.length === 2) {
    const name = parsed[1].trim();
    const apiUsers = getAPIUserByName({ name });
    if (apiUsers.length === 0) {
      await sassybotRespond(
        message,
        `I'm sorry ${name}, I don't see you as a current FC member, when I last checked at: ${getMostRecentPull()}. Sasner can add you to the database if needed.`,
      );
    }
    let apiUser: false | ICotMemberRoW = false;
    if (apiUsers.length === 1) {
      apiUser = apiUsers[0];
      if (apiUser.user_id !== id) {
        updateAPIUserId({ name, id });
      }
    }
    const membersByName = CoTMember.findByName(name);
    if (!membersByName || membersByName.length === 0) {
      let rank = 'Recruit';
      if (apiUser) {
        rank = apiUser.rank;
      }
      const newMember = new CoTMember(id, name, rank);
      newMember.addMember();

      switch (rank.toLowerCase()) {
        case 'member':
          if (cotRoles.Member) {
            await message.member.addRole(cotRoles.Member).catch(console.error);
          }
          break;
        case 'officer':
          await sassybotRespond(
            message,
            "I cannot add the Officer Rank, please have Tyr update you. I've temporarily set you to Veteran",
          );
        case 'veteran':
          if (cotRoles.Veteran) {
            await message.member.addRole(cotRoles.Veteran).catch(console.error);
          }
          break;
        case 'recruit':
        default:
          if (cotRoles.Recruit) {
            await message.member.addRole(cotRoles.Recruit).catch(console.error);
          }
          break;
      }

      await sassybotRespond(message, `Thank you, I now have you as: ${name}`);
      return;
    }
    if (membersByName.length > 1) {
      await sassybotRespond(
        message,
        `There seem to be more than 1 ${name} in my database, please contact Sasner to have the duplicates removed, then you can try again.`,
      );
      return;
    }
    await sassybotRespond(
      message,
      `'I'm Sorry, but it seems ${name} is in an invalid state, please contact Sasner to have it correct, then you can try again.`,
    );
  }
};

export let ClaimUser: ISassyBotImport = {
  functions: {
    claim: (message: Message) => {
      return claimUser(message);
    },
  },
  help: {
    claim: 'usage: `!{sassybot|sb} claim ${YOUR+CHAR+NAME}` ---- ex: `!sb claim Sasner Rensas`',
  },
};
