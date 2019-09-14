import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import Quote from './Quote';

@Entity()
export default class SbUser {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public discordUserId!: string;

  @Column()
  public timezone!: string;

  @OneToMany((type) => Quote, (quote) => quote.user)
  public quotes!: Quote[];
}
