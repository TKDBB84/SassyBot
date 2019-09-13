import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import COTMember  from './COTMember';
import { CotRanks } from "../consts";

@Entity()
export default class PromotionRequest {
  @PrimaryGeneratedColumn()
  public id!: number;

  @CreateDateColumn()
  public requested!: Date;

  @Column({
    default: CotRanks.MEMBER,
    enum: CotRanks,
    type: 'enum',
  })
  public toRank!: CotRanks;

  @ManyToOne((type) => COTMember, (cotMember: COTMember) => cotMember.promotions)
  public CotMember!: COTMember;
}
