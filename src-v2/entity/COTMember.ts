import { ChildEntity, Column, OneToMany } from 'typeorm';
import { FFXIVPlayer } from './FFXIVPlayer';
import { PromotionRequest } from './PromotionRequest';

export enum CotRanks {
  OFFICER = 'Officer',
  DIGNITARY = 'Dignitary/Mod',
  VETERAN = 'Veteran',
  MEMBER = 'Member',
  RECRUIT = 'Recruit',
  NEW = 'New',
}

@ChildEntity()
export class COTMember extends FFXIVPlayer {
  @Column({
    type: 'enum',
    enum: CotRanks,
    default: CotRanks.NEW,
  })
  rank: CotRanks;

  @Column('datetime')
  first_seen_discord: Date;

  @Column('datetime')
  last_promotion: Date;

  @OneToMany((type) => PromotionRequest, (promotionRequest) => promotionRequest.CotMember, { eager: true })
  promotions: PromotionRequest[];
}
