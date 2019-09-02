import * as sqlite3 from 'better-sqlite3';
import { Database, Statement } from 'better-sqlite3';

class SassyDb {
  public connection: Database;
  private stmtAddSpamChannel: Statement;
  private stmtRemoveSpamChannel: Statement;
  private stmtGetSpamChannels: Statement;

  public constructor() {
    this.connection = new sqlite3('/home/nodebot/data/nodebot.sqlite');
    this.connection.exec(
      'CREATE TABLE IF NOT EXISTS spam_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT) WITHOUT ROWID;'
    );

    this.stmtAddSpamChannel = this.connection.prepare(
      'INSERT INTO spam_channels (guild_id, channel_id) VALUES (:guild_id, :channel_id);'
    );
    this.stmtRemoveSpamChannel = this.connection.prepare(
      'DELETE FROM spam_channels WHERE guild_id = :guild_id;'
    );
    this.stmtGetSpamChannels = this.connection.prepare(
      'SELECT * FROM spam_channels'
    );
    process.on('exit', () => this.connection.close());
    process.on('SIGHUP', () => process.exit(128 + 1));
    process.on('SIGINT', () => process.exit(128 + 2));
    process.on('SIGTERM', () => process.exit(128 + 15));
  }

  public getSpamChannelMap: () => Map<string, string> = (): Map<
    string,
    string
  > => {
    const channelList = new Map();
    const spamChannels = this.stmtGetSpamChannels.all();
    for (let i = 0, iMax = spamChannels.length; i < iMax; i++) {
      const guildId = spamChannels[i].guild_id;
      const channelId = spamChannels[i].channel_id;

      channelList.set(guildId, channelId);
    }
    return channelList;
  };
  public addSpamChannel: (guildId: string, channelId: string) => void = (
    guildId: string,
    channelId: string
  ): void => {
    this.stmtAddSpamChannel.run({
      guild_id: guildId,
      channel_id: channelId
    });
  };
  public removeSpamChannel: (guildId: string) => void = (
    guildId: string
  ): void => {
    this.stmtRemoveSpamChannel.run({ guild_id: guildId });
  };
}

export default SassyDb;
