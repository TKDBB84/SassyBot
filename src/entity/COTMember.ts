import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { CotRanks } from '../consts';
import AbsentRequest from './AbsentRequest';
import FFXIVPlayer from './FFXIVPlayer';
import PromotionRequest from './PromotionRequest';

@Entity()
export default class COTMember extends FFXIVPlayer {
  @Column({
    default: CotRanks.NEW,
    enum: CotRanks,
    type: 'enum',
  })
  public rank!: CotRanks;

  @Column()
  public firstSeenDiscord!: Date;

  @Column()
  public lastPromotion!: Date;

  @OneToMany((type) => PromotionRequest, (promotionRequest: PromotionRequest) => promotionRequest.CotMember)
  public promotions!: PromotionRequest[];

  @OneToMany((type) => AbsentRequest, (absentRequest: AbsentRequest) => absentRequest.CotMember)
  public absences!: AbsentRequest[];

  @OneToOne((type) => FFXIVPlayer, { eager: true })
  @JoinColumn()
  public player!: FFXIVPlayer;
}
