import { User } from './Users'
import SassyDb from './SassyDb'
import * as fs from "fs";

type client_secrets = { token: string, xivApiToken: string }
const getSecrets: () => client_secrets = (): client_secrets => {
    const fileData = fs.readFileSync("/home/nodebot/src/client_secrets.json");
    return JSON.parse(fileData.toString());
};
const XIVApi = require('xivapi-js');
export const xivClient = new XIVApi({
    private_key: getSecrets().xivApiToken
});


const db = new SassyDb();

db.connection.exec(
    'CREATE TABLE IF NOT EXISTS cot_member (lodestoneId TEXT PRIMARY KEY, user_id TEXT, name TEXT, rank TEXT, last_update INTEGER)'
);

const memberCount = db.connection.prepare(
    'SELECT COUNT(DISTINCT user_id) as cnt FROM cot_member;'
);
type MemberRow = { lodestoneId: string, user_id: string, name: string, rank: string, last_update: number };
const getMemberByName = db.connection.prepare(
    'SELECT * FROM cot_member WHERE name = ? COLLATE NOCASE'
);

const upsertMember = db.connection.prepare(
    'INSERT INTO cot_member (user_id, name, rank, lodestoneId, last_update) VALUES (?, ?, ?, ?, ?) ON CONFLICT(lodestoneId) DO UPDATE set name = ?, rank = ?, last_update = ?, user_id = ?'
);

const getMemberByUserId = db.connection.prepare(
    'SELECT * FROM cot_member where user_id = ?'
);

const getMemberByLodeId = db.connection.prepare(
    'SELECT * FROM cot_member where lodestoneId = ?'
);

export type FreeCompanyMember =  {
    Avatar: 'https://img2.finalfantasyxiv.com/f/9bb002c4984cb609a79dd28c4079c5d4_ce736afe35e2ded4e46c4fd0659aef7efc0_96x96.jpg',
    FeastMatches: number,
    ID: number,
    Name: string,
    Rank: string,
    RankIcon: string,
    Server: string,
};

let cotMemberList: FreeCompanyMember[] = [];
const lastImport: Date = new Date();
const mbrCount = memberCount.get();
if (mbrCount && mbrCount.cnt === 0) {
    const CoTId = '9229001536389012456';
    xivClient.freecompany.get(CoTId, {extended: 1, data: 'FCM'}).then(
        (result: { FreeCompany: {}, FreeCompanyMembers: FreeCompanyMember[], Info: {FreeCompanyMembers: {Updated: number}}}) => {
            cotMemberList = result.FreeCompanyMembers;
            lastImport.setTime(result.Info.FreeCompanyMembers.Updated * 1000);
            cotMemberList.forEach(member => {
                upsertMember.run([
                    '',
                    member.Name,
                    member.Rank,
                    member.ID,
                    lastImport.getTime()/1000,
                    member.Name,
                    member.Rank,
                    lastImport.getTime()/1000,
                    '',
                ])
            })
        }
    );
}

const addMember = db.connection.prepare(
    "INSERT INTO cot_member (user_id, name, rank, lodestoneId, last_update) VALUES (?, ?, ?, ?, ?)"
);
const updateMember = db.connection.prepare(
    "UPDATE cot_member SET name = ?, rank = ?, lodestoneId = ?, last_update = ? WHERE user_id = ?"
);
const updateMemberByLode = db.connection.prepare(
    "UPDATE cot_member SET name = ?, rank = ?, user_id = ?, last_update = ? WHERE lodestoneId = ?"
);

export class CoTMember extends User {
    public id: string = '';
    public name: string = '';
    public rank: string = '';
    public lodestoneId: string = '';
    public lastUpdated: Date = new Date();

    public constructor(id: string, lodestoneId: string = '', name: string = '', rank: string = '', lastUpdated: Date = new Date()) {
        super(id);
        this.id = id;
        this.lodestoneId = lodestoneId;
        this.name = name;
        this.rank = rank;
        this.lastUpdated = lastUpdated;
    }

    public save(): boolean {
        if (!this.id) {
            return false;
        }
        const exists: MemberRow = getMemberByUserId.get([this.id]);
        console.log({exists});
        if (exists && exists.user_id) {
            updateMember.run([
                this.name,
                this.rank,
                this.lodestoneId,
                this.lastUpdated.getTime() / 1000,
                this.id
            ]);
            return true;
        }
        if (this.lodestoneId) {
            const lodeExists: MemberRow = getMemberByLodeId.get([this.lodestoneId]);
            console.log({lodeExists})
            if (lodeExists && lodeExists.lodestoneId) {
                if (this.id) {
                    updateMemberByLode.run([
                        this.name,
                        this.rank,
                        this.id,
                        this.lastUpdated.getTime() / 1000,
                        this.lodestoneId,
                    ]);
                }
            }
        } else {
            addMember.run([
                this.id,
                this.name,
                this.rank,
                this.lodestoneId
            ]);
        }
        return true;
    }

    static fetchMember(user_id: string): CoTMember | false {
        const row: MemberRow = getMemberByUserId.get([user_id]);
        console.log({fetchedRow: row});
        if (!row) {
            return false
        }
        const lastUpdate = new Date();
        lastUpdate.setTime(row.last_update * 1000);
        return new CoTMember(row.user_id, row.lodestoneId, row.name, row.rank, lastUpdate);
    }

    static findByName(user_id: string, name: string): CoTMember[] | false {
        const matchingRows: MemberRow[] = getMemberByName.all([name]);
        if (!matchingRows) {
            return false
        }
        const results: CoTMember[] = [];
        matchingRows.forEach(row => {
            const lastUpdate = new Date();
            lastUpdate.setTime(row.last_update * 1000);
            results.push(new CoTMember(user_id, row.lodestoneId, row.name, row.rank, lastUpdate))
        });
        return results;
    }
}