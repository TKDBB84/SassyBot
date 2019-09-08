import { PrimaryGeneratedColumn, Column, Entity, TableInheritance, ManyToOne } from 'typeorm';
import { User } from './User';

@Entity()
export class Quote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => User, (user) => user.quotes, { eager: true })
  user: User;
}
