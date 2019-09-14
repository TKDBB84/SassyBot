import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne } from 'typeorm';
import SbUser from './SbUser';

@Entity()
export default class FFXIVPlayer extends SbUser {
  @Column()
  public apiId!: number;

  @Column()
  public charName!: string;

  @CreateDateColumn()
  public firstSeenApi!: Date;

  @Column()
  public lastSeenApi!: Date;

  @OneToOne((type) => SbUser, { eager: true })
  @JoinColumn()
  public user!: SbUser;
}
