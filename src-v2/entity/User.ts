import { PrimaryGeneratedColumn, Column, Entity, TableInheritance, OneToMany } from 'typeorm';
import { Quote } from './Quote';

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 255 })
  discordUserId: string;

  @Column('varchar', { length: 255, default: 'UTC'})
  timezone: string;

  @OneToMany((type) => Quote, (quote) => quote.user, { eager: true })
  quotes: Quote[];
}
