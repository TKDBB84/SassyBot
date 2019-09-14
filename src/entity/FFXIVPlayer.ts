import { ChildEntity, Column, CreateDateColumn, OneToOne, JoinColumn, Entity } from 'typeorm';
import SbUser from './SbUser';
import COTMember from "./COTMember";

@Entity()
export default class FFXIVPlayer extends SbUser {
  @Column()
  public apiId!: number;

  @Column()
  public charName!: string;

  @CreateDateColumn()
  public firstSeenApi!: Date;

  @Column()
  public lastSeenApi!: Date;

  @OneToOne(type => SbUser, {eager: true})
  @JoinColumn()
  public user!: SbUser;
}
