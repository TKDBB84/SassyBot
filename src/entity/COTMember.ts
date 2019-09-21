import { Column, Entity, getManager, JoinColumn, OneToMany, OneToOne } from 'typeorm';
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

  public async promote() {
    switch (this.rank) {
      case CotRanks.NEW:
        this.rank = CotRanks.RECRUIT;
        break;
      case CotRanks.MEMBER:
        this.rank = CotRanks.VETERAN;
        break;
      case CotRanks.VETERAN:
        this.rank = CotRanks.OFFICER;
        break;
      default:
      case CotRanks.RECRUIT:
        this.rank = CotRanks.MEMBER;
        break;
    }
    this.lastPromotion = new Date();
    await getManager()
      .getRepository(COTMember)
      .save(this);
  }
}
