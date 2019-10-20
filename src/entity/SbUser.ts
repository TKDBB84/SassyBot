import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import Quote from './Quote';

@Entity()
export default class SbUser {
  @PrimaryColumn()
  public discordUserId!: string;

  @Column()
  public timezone!: string;

  @OneToMany((type) => Quote, (quote) => quote.user)
  public quotes!: Quote[];
}
