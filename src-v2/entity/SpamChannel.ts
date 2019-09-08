import { PrimaryColumn, Column, Entity } from 'typeorm';

@Entity()
export class SpamChannel {
  @PrimaryColumn('varchar', { length: 255 })
  guildId: string;

  @Column('varchar', { length: 255 })
  channelId: string;

  @Column('varchar', { length: 255, default: 'UTC'})
  timezone: string;
}
