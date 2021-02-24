import { Column, Entity, getManager, OneToMany, PrimaryColumn } from 'typeorm';
import Event from './Event';
import Quote from './Quote';

@Entity()
export default class SbUser {
  public static async findOrCreateUser(discordUserId: string): Promise<SbUser> {
    const sbUserRepo = getManager().getRepository(SbUser);

    let sbUser = await sbUserRepo.findOne(discordUserId);
    if (!sbUser) {
      sbUser = new SbUser();
      sbUser.discordUserId = discordUserId;
      sbUser = await sbUserRepo.save(sbUser, { reload: true });
    }
    return sbUser;
  }

  @PrimaryColumn()
  public discordUserId!: string;

  @Column()
  public timezone!: string;

  @OneToMany(() => Quote, (quote) => quote.user)
  public quotes!: Quote[];

  @OneToMany(() => Event, (event) => event.user)
  public events!: Event[];
}
