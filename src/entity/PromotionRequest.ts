import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { COTMember, CotRanks } from './COTMember';

@Entity()
export class PromotionRequest {
  @PrimaryGeneratedColumn()
  public id: number;

  @CreateDateColumn('datetime')
  public requested: Date;

  @Column({
    default: CotRanks.MEMBER,
    enum: CotRanks,
    type: 'enum',
  })
  public toRank: CotRanks;

  @ManyToOne((type) => COTMember, (cotMember) => cotMember.promotions, { eager: true })
  public CotMember: COTMember;
}
