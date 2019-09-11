import { Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class Quote {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne((type) => User, (user) => user.quotes, { eager: true })
  public user!: User;
}
