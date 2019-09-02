// import * as fs from 'fs';
import SassyDb from './SassyDb';
import { User } from './Users';

interface IMemberRow {
  user_id: string;
  name: string;
  rank: string;
  first_seen_discord: number;
  last_promotion: number;
}

// export interface IFreeCompanyMember {
//   Avatar: 'https://img2.finalfantasyxiv.com/f/9bb002c4984cb609a79dd28c4079c5d4_ce736afe35e2ded4e46c4fd0659aef7efc0_96x96.jpg';
//   FeastMatches: number;
//   ID: number;
//   Name: string;
//   Rank: string;
//   RankIcon: string;
//   Server: string;
// }
//
// interface IClientSecrets {
//   token: string;
//   xivApiToken: string;
// }
//
// const getSecrets: () => IClientSecrets = (): IClientSecrets => {
//   const fileData = fs.readFileSync('/home/nodebot/src/client_secrets.json');
//   return JSON.parse(fileData.toString());
// };
//
// // tslint:disable-next-line:no-var-requires
// const XIVApi = require('xivapi-js');
// export const xivClient = new XIVApi({
//   private_key: getSecrets().xivApiToken,
// });

const db = new SassyDb();
db.connection.exec(
  'CREATE TABLE IF NOT EXISTS cot_promotion_tracking (user_id TEXT PRIMARY KEY, name TEXT, rank TEXT, first_seen_discord TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_promotion TIMESTAMP);',
);

db.connection.exec('DROP TABLE IF EXISTS cot_member');

db.connection.exec(
  'CREATE TABLE IF NOT EXISTS cot_members (api_id TEXT PRIMARY KEY, user_id TEXT, name TEXT, rank TEXT, first_seen_api TIMESTAMP DEFAULT CURRENT_TIMESTAMP);',
);

type AddMemberFunction = ({ userId, name }: { userId: string; name: string }) => boolean;
const addMember: AddMemberFunction = ({ userId, name }) => {
  const member = db.connection.prepare('INSERT INTO cot_promotion_tracking (user_id, name, rank) VALUES (?, ?, ?)');
  const result = member.run([userId, name, '']);
  return !!result.lastInsertRowid;
};

type getMemberByNameFunction = ({ name }: { name: string }) => IMemberRow[];
const getMemberByName: getMemberByNameFunction = ({ name }) => {
  const memberByName = db.connection.prepare('SELECT * FROM cot_promotion_tracking WHERE name = ? COLLATE NOCASE');
  return memberByName.all([name]);
};

type getMemberByIdFunction = ({ user_id }: { user_id: string }) => IMemberRow;
const getMemberByUserId: getMemberByIdFunction = ({ user_id }) => {
  const memberByUserId = db.connection.prepare('SELECT * FROM cot_promotion_tracking where user_id = ?');
  return memberByUserId.get([user_id]);
};

type promoteMember = ({ id }: { id: string }) => boolean;
const promoteByMember: promoteMember = ({ id }) => {
  const memberByUserId = db.connection.prepare(
    'UPDATE cot_promotion_tracking SET last_promotion = CURRENT_TIMESTAMP WHERE user_id = ? COLLATE NOCASE',
  );
  const result = memberByUserId.run([id]);
  return !!result.changes;
};

export class CoTMember extends User {
  public static fetchMember(userId: string): CoTMember | false {
    const row: IMemberRow = getMemberByUserId({ user_id: userId });
    if (!row) {
      return false;
    }
    return new CoTMember(row.user_id, row.name);
  }

  public static findByName(name: string): CoTMember[] | false {
    const matchingRows: IMemberRow[] = getMemberByName({ name });
    if (!matchingRows) {
      return false;
    }
    const results: CoTMember[] = [];
    matchingRows.forEach((row) => {
      results.push(new CoTMember(row.user_id, row.name));
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

  public id: string = '';
  public name: string = '';
  public firstSeenDiscord: string = '';
  public lastPromotion: string = '';

  public constructor(id: string, name: string = '') {
    super(id);
    this.id = id;
    this.name = name;
  }

  public save(): boolean {
    if (!this.id) {
      return false;
    }
    const exists: IMemberRow = getMemberByUserId({ user_id: this.id });
    if (exists && exists.user_id) {
      return true;
    }
    addMember({
      name: this.name,
      userId: this.id,
    });
    return true;
  }

  public promote(): boolean {
    return promoteByMember(this);
  }
}
