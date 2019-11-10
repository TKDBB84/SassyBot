import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import SbUser from './SbUser';

@Entity()
export default class FFXIVChar {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public apiId!: number;

  @Column()
  public name!: string;

  @CreateDateColumn()
  public firstSeenApi!: Date;

  @Column()
  public lastSeenApi!: Date;

  @OneToOne(() => SbUser, { eager: true, nullable: true })
  @JoinColumn()
  public user!: SbUser;
}
