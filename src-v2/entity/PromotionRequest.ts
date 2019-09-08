import {PrimaryGeneratedColumn, Entity, ManyToOne, JoinColumn, CreateDateColumn, Column} from 'typeorm';
import {COTMember, CotRanks} from "./COTMember";

@Entity()
export class PromotionRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn('datetime')
  requested: Date;

  @Column({
    type: 'enum',
    enum: CotRanks,
    default: CotRanks.MEMBER,
  })
  toRank: CotRanks;

  @ManyToOne((type) => COTMember, (cotMember) => cotMember.promotions, { eager: true })
  CotMember: COTMember;
}
