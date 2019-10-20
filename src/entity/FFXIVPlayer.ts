import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne } from 'typeorm';
import SbUser from './SbUser';

@Entity()
export default class FFXIVPlayer {
  @Column()
  public apiId!: number;

  @Column()
  public charName!: string;

  @CreateDateColumn()
  public firstSeenApi!: Date;

  @Column()
  public lastSeenApi!: Date;

  @OneToOne(() => SbUser, { eager: true })
  @JoinColumn()
  public user!: SbUser;
}
