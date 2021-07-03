import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import SbUser from './SbUser';

@Entity()
export default class FFXIVChar {
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
