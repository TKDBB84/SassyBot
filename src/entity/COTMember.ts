import { Column, Entity, getManager, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CotRanks } from '../consts';
import { logger } from '../log';
import AbsentRequest from './AbsentRequest';
import FFXIVChar from './FFXIVChar';
import PromotionRequest from './PromotionRequest';

@Entity()
export default class COTMember {
  public static async findOrCreateCotMember(
    cotCharacter: FFXIVChar,
    rank: CotRanks = CotRanks.NEW,
  ): Promise<COTMember> {
    const cotMemberRepo = getManager().getRepository(COTMember);

    let cotMember = await cotMemberRepo
      .createQueryBuilder()
      .where('characterId = :id', { id: cotCharacter.id })
      .getOne();
    const foundMember = cotMember;
    if (!cotMember) {
      cotMember = new COTMember();
      cotMember.character = cotCharacter;
      cotMember.rank = rank;
      cotMember.firstSeenDiscord = new Date();
      try {
        cotMember = await cotMemberRepo.save(cotMember, { reload: true });
      } catch (error) {
        logger.warn('error saving member', { error, foundMember, cotMember });
        throw error;
      }
    } else {
      const firstSeenDiscord = cotMember.firstSeenDiscord ? cotMember.firstSeenDiscord : new Date();
      await cotMemberRepo.update(cotMember.id, { firstSeenDiscord, character: cotCharacter });
    }
    cotMember.character = cotCharacter;
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

  @OneToMany(() => PromotionRequest, (promotionRequest: PromotionRequest) => promotionRequest.CotMember)
  public promotions!: PromotionRequest[];

  @OneToMany(() => AbsentRequest, (absentRequest: AbsentRequest) => absentRequest.CotMember)
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
    const lastPromotion = new Date();
    await getManager().getRepository(COTMember).update(this.id, { lastPromotion, rank: newRank });
    const updatedMember = await getManager().getRepository(COTMember).findOne(this.id);
    if (!updatedMember) {
      throw new Error('same member not found?');
    }
    return updatedMember;
  }
}
