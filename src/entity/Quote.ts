import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import User from './User';

@Entity()
export default class Quote {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public guildId!: string;

  @Column()
  public channelId!: string;

  @Column()
  public messageId!: string;

  @CreateDateColumn()
  public created!: Date;

  @Column()
  public quoteText!: string;

  @ManyToOne(type => User, user => user.quotes)
  public user!: User;
}
