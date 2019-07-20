import { User } from './Users'
import SassyDb from './SassyDb'

const db = new SassyDb();

db.connection.exec(
    'CREATE TABLE IF NOT EXISTS cot_member (user_id TEXT PRIMARY KEY, name TEXT, rank TEXT, lodestoneId TEXT, last_update INTEGER)'
);

const memberCount = db.connection.prepare(
    'SELECT COUNT(DISTINCT user_id) as cnt FROM cot_member;'
);

const mbrCount = memberCount.get();
if (mbrCount && mbrCount.cnt > 0) {
    // import them from api
}

const addMember = db.connection.prepare(
    "INSERT INTO cot_member (user_id, name, rank, lodestoneId, last_update) VALUES (?, ?, ?, ?, strftime('%s','now'))"
);
const updateMember = db.connection.prepare(
    "UPDATE cot_member SET name = ?, rank = ?, lodestoneId = ?, last_update = strftime('%s','now') WHERE user_id = ?"
);
type ExistRow = { ext: number }
const memberExists = db.connection.prepare(
    'SELECT 1 as ext FROM cot_member WHERE user_id = ?'
);

type UserRow = { name: string, rank: string, lodestoneId: string, last_update: number }
const getUser = db.connection.prepare(
    "SELECT name, rank, lodestoneId, last_update FROM cot_member WHERE user_id = ?"
);

export class CoTMembers extends User {
    public id: string;
    public name: string;
    public rank: string;
    public lodestoneId: string;
    public lastUpdated: Date;

    public constructor(id: string, name: string = '', rank: string = '', lodestoneId: string = '' ) {
        super(id);
        this.id = id;
        this.name = name;
        this.rank = rank;
        this.lodestoneId = lodestoneId;
        this.lastUpdated = new Date();
        if (this.id) {
            const exists: ExistRow = memberExists.get([this.id]);
            if (!exists || !exists.ext) {
                this.save();
            } else {
                this.fetchUser();
            }
        }
    }

    public save(): boolean {
        if (!this.id) {
            return false;
        }
        const exists: ExistRow = memberExists.get([this.id]);
        if (exists && !!exists.ext) {
            updateMember.run([
                this.name,
                this.rank,
                this.lodestoneId,
                this.id
            ]);
        } else {
            addMember.run([
                this.id,
                this.name,
                this.rank,
                this.lodestoneId
            ]);
        }
        return true
    }

    private fetchUser() {
        if (this.id) {
            const userData: UserRow = getUser.get([this.id]);
            if (userData) {
                if (userData.name) {
                    this.name = userData.name;
                }
                if (userData.rank) {
                    this.rank = userData.rank;
                }
                if (userData.lodestoneId) {
                    this.lodestoneId = userData.lodestoneId;
                }
                if (userData.last_update) {
                    const newDate = new Date();
                    newDate.setTime(userData.last_update * 1000);
                    this.lastUpdated = newDate;
                }
            }
        }
    }
}