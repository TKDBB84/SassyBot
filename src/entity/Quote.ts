import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import User from './User';

@Entity()
export default class Quote {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column('varchar', { length: 255 })
  public guildId!: string;

  @Column('varchar', { length: 255 })
  public channelId!: string;

  @Column('varchar', { length: 255 })
  public messageId!: string;

  @CreateDateColumn()
  public created!: Date;

  @ManyToOne((type) => User, (user: User) => user.quotes, { eager: true })
  public user!: User;
}
