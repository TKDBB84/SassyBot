import { User } from "./Users";
import SassyDb from "./SassyDb";

type MemberRow = {
  user_id: string;
  name: string;
  rank: string;
  first_seen_discord: number;
  last_promotion: number;
};

// import * as fs from "fs";
// type client_secrets = { token: string, xivApiToken: string }
// const getSecrets: () => client_secrets = (): client_secrets => {
//     const fileData = fs.readFileSync("/home/nodebot/src/client_secrets.json");
//     return JSON.parse(fileData.toString());
// };
// const XIVApi = require('xivapi-js');
// export const xivClient = new XIVApi({
//     private_key: getSecrets().xivApiToken
// });

const db = new SassyDb();
db.connection.exec(
  "CREATE TABLE IF NOT EXISTS cot_promotion_tracking (user_id TEXT PRIMARY KEY, name TEXT, rank TEXT, first_seen_discord TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_promotion TIMESTAMP);"
);

type AddMemberFunction = ({
  user_id,
  name
}: {
  user_id: string;
  name: string;
}) => boolean;
const addMember: AddMemberFunction = ({ user_id, name }) => {
  const addMember = db.connection.prepare(
    "INSERT INTO cot_promotion_tracking (user_id, name, rank) VALUES (?, ?, ?)"
  );
  const result = addMember.run([user_id, name, ""]);
  return !!result.lastInsertRowid;
};

// type UpdateMemberFunction = ({user_id, name, last_promotion}: {user_id: string, name: string, last_promotion: string}) => boolean;
// const updateMemberById: UpdateMemberFunction = ({user_id, name, last_promotion = ''}) => {
//     const updateMemberById = db.connection.prepare(
//         'UPDATE cot_promotion_tracking SET name = ?, rank = ?, last_promotion = ? WHERE user_id = ?'
//     );
//     const result = updateMemberById.run([name, '', last_promotion, user_id]);
//     return !!result.changes
// };

// const memberCount: () => number = () => {
//     const memberCount = db.connection.prepare(
//         'SELECT COUNT(DISTINCT user_id) as cnt FROM cot_promotion_tracking;'
//     );
//     const result = memberCount.get();
//     if (result.cnt) {
//         return parseInt(result.cnt, 10)
//     }
//     return 0;
// };

type getMemberByNameFunction = ({ name }: { name: string }) => MemberRow[];
const getMemberByName: getMemberByNameFunction = ({ name }) => {
  const getMemberByName = db.connection.prepare(
    "SELECT * FROM cot_promotion_tracking WHERE name = ? COLLATE NOCASE"
  );
  return getMemberByName.all([name]);
};

type getMemberByIdFunction = ({ user_id }: { user_id: string }) => MemberRow;
const getMemberByUserId: getMemberByIdFunction = ({ user_id }) => {
  const getMemberByUserId = db.connection.prepare(
    "SELECT * FROM cot_promotion_tracking where user_id = ?"
  );
  return getMemberByUserId.get([user_id]);
};
//
// export type FreeCompanyMember =  {
//     Avatar: 'https://img2.finalfantasyxiv.com/f/9bb002c4984cb609a79dd28c4079c5d4_ce736afe35e2ded4e46c4fd0659aef7efc0_96x96.jpg',
//     FeastMatches: number,
//     ID: number,
//     Name: string,
//     Rank: string,
//     RankIcon: string,
//     Server: string,
// };

export class CoTMember extends User {
  public id: string = "";
  public name: string = "";
  public first_seen_discord: string = "";
  public last_promotion: string = "";

  public constructor(id: string, name: string = "") {
    super(id);
    this.id = id;
    this.name = name;
  }

  public save(): boolean {
    if (!this.id) {
      return false;
    }
    const exists: MemberRow = getMemberByUserId({ user_id: this.id });
    if (exists && exists.user_id) {
      return true;
    }
    addMember({
      user_id: this.id,
      name: this.name
    });
    return true;
  }

  static fetchMember(user_id: string): CoTMember | false {
    const row: MemberRow = getMemberByUserId({ user_id });
    if (!row) {
      return false;
    }
    return new CoTMember(row.user_id, row.name);
  }

  static findByName(name: string): CoTMember[] | false {
    const matchingRows: MemberRow[] = getMemberByName({ name });
    if (!matchingRows) {
      return false;
    }
    const results: CoTMember[] = [];
    matchingRows.forEach(row => {
      results.push(new CoTMember(row.user_id, row.name));
    });
    return results;
  }
}
