import { Column, Entity, getManager, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CotRanks } from '../consts';
import AbsentRequest from './AbsentRequest';
import FFXIVChar from './FFXIVChar';
import PromotionRequest from './PromotionRequest';
import SbUser from './SbUser';

@Entity()
export default class COTMember {
  public static async getCotMemberByName(
    charName: string,
    discordUserId: string,
    rank: CotRanks = CotRanks.NEW,
  ): Promise<COTMember> {
    const cotPlayerRepo = getManager().getRepository(FFXIVChar);
    const cotMemberRepo = getManager().getRepository(COTMember);
    const sbUserRepo = getManager().getRepository(SbUser);

    let sbUser = await sbUserRepo.findOne(discordUserId);
    if (!sbUser) {
      sbUser = new SbUser();
      sbUser.discordUserId = discordUserId;
      sbUser = await sbUserRepo.save(sbUser);
    }
    let cotPlayer = await cotPlayerRepo.findOne({
      where: { user: { discordUserId } },
    });

    if (!cotPlayer) {
      const nameMatch = await cotPlayerRepo
        .createQueryBuilder()
        .where(`LOWER(name) = LOWER(:name)`, { name: charName.toLowerCase() })
        .getOne();
      if (!nameMatch) {
        cotPlayer = new FFXIVChar();
        cotPlayer.user = sbUser;
        cotPlayer.name = charName;
        cotPlayer = await cotPlayerRepo.save(cotPlayer);
      } else {
        cotPlayer = nameMatch;
        await cotPlayerRepo.update(cotPlayer.id, { user: sbUser });
      }
    }

    let cotMember = await cotMemberRepo
      .createQueryBuilder()
      .where('characterId = :id', { id: cotPlayer.id })
      .getOne();
    const foundMember = cotMember;
    if (!cotMember) {
      cotMember = new COTMember();
      cotMember.character = cotPlayer;
      cotMember.rank = rank;
      cotMember.firstSeenDiscord = new Date();
      try {
        cotMember = await cotMemberRepo.save(cotMember);
      } catch (e) {
        console.log({ e, foundMember, cotMember });
        throw e;
      }
    } else {
      const firstSeenDiscord = cotMember.firstSeenDiscord ? cotMember.firstSeenDiscord : new Date();
      await cotMemberRepo.update(cotMember.id, { firstSeenDiscord, character: cotPlayer });
    }
    cotPlayer.user = sbUser;
    cotMember.character = cotPlayer;
    return cotMember;
  }

  @PrimaryGeneratedColumn()
  public id!: number;

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

  @OneToMany(
    () => PromotionRequest,
    (promotionRequest: PromotionRequest) => promotionRequest.CotMember,
  )
  public promotions!: PromotionRequest[];

  @OneToMany(
    () => AbsentRequest,
    (absentRequest: AbsentRequest) => absentRequest.CotMember,
  )
  public absences!: AbsentRequest[];

  @OneToOne(() => FFXIVChar, { eager: true })
  @JoinColumn()
  public character!: FFXIVChar;

  public async promote(): Promise<COTMember> {
    let newRank;
    switch (this.rank) {
      case CotRanks.NEW:
        newRank = CotRanks.RECRUIT;
        break;
      case CotRanks.MEMBER:
        newRank = CotRanks.VETERAN;
        break;
      case CotRanks.VETERAN:
        newRank = CotRanks.OFFICER;
        break;
      default:
      case CotRanks.RECRUIT:
        newRank = CotRanks.MEMBER;
        break;
    }
    let lastPromotion = new Date();
    await getManager()
      .getRepository(COTMember)
      .update(this.id, { lastPromotion, rank: newRank });
    const updatedMember = await getManager()
      .getRepository(COTMember)
      .findOne(this.id);
    if (!updatedMember) {
      throw new Error('same member not found?');
    }
    return updatedMember;
  }
}
