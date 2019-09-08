import { PrimaryGeneratedColumn, Column, Entity } from 'typeorm';

@Entity()
export class SpamChannel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 255 })
  guildId: string;

  @Column('varchar', { length: 255 })
  channelId: string;
}
