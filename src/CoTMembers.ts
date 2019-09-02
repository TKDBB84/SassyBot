import * as fs from 'fs';
import * as http2 from 'http2';
import SassyDb from './SassyDb';
import { User } from './Users';

interface IMemberRow {
  user_id: string;
  name: string;
  rank: string;
  first_seen_discord: number;
  last_promotion: number;
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

db.connection.exec('DROP TABLE IF EXISTS cot_member');

db.connection.exec(
  'CREATE TABLE IF NOT EXISTS cot_members (api_id TEXT PRIMARY KEY, user_id TEXT, name TEXT, rank TEXT, first_seen_api TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_seen_api TIMESTAMP DEFAULT CURRENT_TIMESTAMP);',
);

type upsertMemberFunction = ({ ID, Name, Rank }: IFreeCompanyMember) => boolean;
const upsertMember: upsertMemberFunction = ({ ID, Name, Rank }) => {
  const stmtUpsertMember = db.connection.prepare("INSERT INTO cot_members (api_id, user_id, name, rank) VALUES (?, '', ?, ?) ON CONFLICT(api_id) DO UPDATE SET rank = ?, last_seen_api = CURRENT_TIMESTAMP");
  const result = stmtUpsertMember.run([ID, Name, Rank, Rank]);
  return !!result.lastInsertRowid || !!result.changes
};

const getSecrets: () => IClientSecrets = (): IClientSecrets => {
  const fileData = fs.readFileSync('/home/nodebot/src/client_secrets.json');
  return JSON.parse(fileData.toString());
};

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

setInterval(async () => {
  const currentMembers = await getLatestMemberList();
  currentMembers.map(upsertMember);
}, ONE_HOUR * 12);

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
