import { ChildEntity, Column, OneToMany } from 'typeorm';
import { FFXIVPlayer } from './FFXIVPlayer';
import { PromotionRequest } from './PromotionRequest';

export enum CotRanks {
  DIGNITARY = 'Dignitary/Mod',
  MEMBER = 'Member',
  NEW = 'New',
  OFFICER = 'Officer',
  RECRUIT = 'Recruit',
  VETERAN = 'Veteran',
}

@ChildEntity()
export class COTMember extends FFXIVPlayer {
  @Column({
    default: CotRanks.NEW,
    enum: CotRanks,
    type: 'enum',
  })
  public rank!: CotRanks;

  @Column('datetime')
  public firstSeenDiscord!: Date;

  @Column('datetime')
  public lastPromotion!: Date;

  @OneToMany((type) => PromotionRequest, (promotionRequest) => promotionRequest.CotMember, { eager: true })
  public promotions!: PromotionRequest[];
}
