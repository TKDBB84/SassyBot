import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import COTMember, { CotRanks } from './COTMember';

@Entity()
export default class PromotionRequest {
  @PrimaryGeneratedColumn()
  public id!: number;

  @CreateDateColumn('datetime')
  public requested!: Date;

  @Column({
    default: CotRanks.MEMBER,
    enum: CotRanks,
    type: 'enum',
  })
  public toRank!: CotRanks;

  @ManyToOne((type) => COTMember, (cotMember: COTMember) => cotMember.promotions, { eager: true })
  public CotMember!: COTMember;
}
