import { Column, Entity, getManager, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import SbUser from './SbUser';

@Entity()
export default class FFXIVChar {
  public static async findOrCreateCharacter(charName: string, sbUser: SbUser): Promise<FFXIVChar> {
    const cotPlayerRepo = getManager().getRepository(FFXIVChar);
    const { discordUserId } = sbUser;
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
        cotPlayer = await cotPlayerRepo.save(cotPlayer, { reload: true });
      } else {
        cotPlayer = nameMatch;
        await cotPlayerRepo.update(cotPlayer.id, { user: sbUser });
        cotPlayer.user = sbUser;
      }
    }

    return cotPlayer;
  }

  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public apiId!: number;

  @Column({ charset: 'utf8', collation: 'utf8_general_ci' })
  public name!: string;

  @Column()
  public firstSeenApi!: Date;

  @Column()
  public lastSeenApi!: Date;

  @OneToOne(() => SbUser, { eager: true, nullable: true })
  @JoinColumn()
  public user!: SbUser;
}
