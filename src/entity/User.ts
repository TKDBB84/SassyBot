import { Column, Entity, OneToMany, PrimaryGeneratedColumn, TableInheritance } from 'typeorm';
import { Quote } from './Quote';

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class User {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column('varchar', { length: 255 })
  public discordUserId!: string;

  @Column('varchar', { length: 255, default: 'UTC' })
  public timezone!: string;

  @OneToMany((type) => Quote, (quote) => quote.user, { eager: true })
  public quotes!: Quote[];
}
