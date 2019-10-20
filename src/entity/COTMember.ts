import { Column, Entity, getManager, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { CotRanks } from '../consts';
import AbsentRequest from './AbsentRequest';
import FFXIVChar from './FFXIVChar';
import PromotionRequest from './PromotionRequest';
import SbUser from './SbUser';

@Entity()
export default class COTMember {
  public static async getCotMemberByName(charName: string, discordUserId: string): Promise<COTMember> {
    const cotMemberRepo = getManager().getRepository(COTMember);
    let cotMember = await cotMemberRepo
      .createQueryBuilder()
      .where('LOWER(name) = :name', { charName })
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
      const cotPlayerRepo = getManager().getRepository(FFXIVChar);
      let cotPlayer = await cotPlayerRepo
        .createQueryBuilder()
        .innerJoinAndSelect(SbUser, 'user')
        .where('user.discordUserId = :discordUserId', { discordUserId })
        .getOne();
      if (!cotPlayer) {
        cotPlayer = new FFXIVChar();
        cotPlayer.user = sbUser;
      }
      cotPlayer.name = charName;
      await cotPlayerRepo.save(cotPlayer);

      cotMember = new COTMember();
      cotMember.character = cotPlayer;
      cotMember.rank = CotRanks.NEW;
      cotMember.firstSeenDiscord = new Date();
    }
    cotMember.character.user.discordUserId = discordUserId;
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

  @OneToOne(() => FFXIVChar, { eager: true })
  @JoinColumn()
  public character!: FFXIVChar;

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
