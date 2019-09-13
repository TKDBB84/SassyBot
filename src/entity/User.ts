import { Column, Entity, OneToMany, PrimaryGeneratedColumn, TableInheritance } from 'typeorm';
import Quote from './Quote';

@Entity()
export default class User {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public discordUserId!: string;

  @Column()
  public timezone!: string;

  @OneToMany(type => Quote, quote => quote.user)
  public quotes!: Quote[];
}
