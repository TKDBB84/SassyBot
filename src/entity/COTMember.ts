import { Column, Entity, getManager, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { CotRanks } from '../consts';
import AbsentRequest from './AbsentRequest';
import FFXIVPlayer from './FFXIVPlayer';
import PromotionRequest from './PromotionRequest';
import SbUser from './SbUser';

@Entity()
export default class COTMember extends FFXIVPlayer {
  public static async getCotMemberByName(charName: string, discordUserId: string): Promise<COTMember> {
    const cotMemberRepo = getManager().getRepository(COTMember);
    let cotMember = await cotMemberRepo
      .createQueryBuilder()
      .where('LOWER(charName) = :charName', { charName })
      .getOne();
    if (!cotMember) {
      const sbUserRepo = getManager().getRepository(SbUser);
      let sbUser = await sbUserRepo
        .createQueryBuilder()
        .where('discordUserId = :discordUserId', { discordUserId })
        .getOne();
      if (!sbUser) {
        sbUser = new SbUser();
        sbUser.discordUserId = discordUserId;
        await sbUserRepo.save(sbUser);
      }
      const cotPlayerRepo = getManager().getRepository(FFXIVPlayer);
      let cotPlayer = await cotPlayerRepo
        .createQueryBuilder()
        .innerJoinAndSelect(SbUser, 'user')
        .where('user.id = :id', { id: sbUser.id })
        .getOne();
      if (!cotPlayer) {
        cotPlayer = new FFXIVPlayer();
        cotPlayer.user = sbUser;
      }
      cotPlayer.charName = charName;
      await cotPlayerRepo.save(cotPlayer);

      cotMember = new COTMember();
      cotMember.player = cotPlayer;
      cotMember.rank = CotRanks.NEW;
      cotMember.firstSeenDiscord = new Date();
    }

    cotMember.discordUserId = discordUserId;
    await cotMemberRepo.save(cotMember);
    return cotMember;
  }

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

  @OneToMany(() => PromotionRequest, (promotionRequest: PromotionRequest) => promotionRequest.CotMember)
  public promotions!: PromotionRequest[];

  @OneToMany(() => AbsentRequest, (absentRequest: AbsentRequest) => absentRequest.CotMember)
  public absences!: AbsentRequest[];

  @OneToOne(() => FFXIVPlayer, { eager: true })
  @JoinColumn()
  public player!: FFXIVPlayer;

  public async promote(): Promise<COTMember> {
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
    return await getManager()
      .getRepository(COTMember)
      .save(this);
  }
}
