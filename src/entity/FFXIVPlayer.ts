import { ChildEntity, Column, CreateDateColumn, OneToOne, JoinColumn, Entity } from 'typeorm';
import User from './User';
import COTMember from "./COTMember";

@Entity()
export default class FFXIVPlayer extends User {
  @Column()
  public apiId!: number;

  @Column()
  public charName!: string;

  @CreateDateColumn()
  public firstSeenApi!: Date;

  @Column()
  public lastSeenApi!: Date;

  @OneToOne(type => User, {eager: true})
  @JoinColumn()
  public user!: User;
}
