import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class SpamChannel {
  @PrimaryColumn('varchar', { length: 255 })
  public guildId!: string;

  @Column('varchar', { length: 255 })
  public channelId!: string;

  @Column('varchar', { length: 255, default: 'UTC' })
  public timezone!: string;
}
