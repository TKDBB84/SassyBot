import { ChildEntity, Column, CreateDateColumn } from 'typeorm';
import { User } from './User';

@ChildEntity()
export class FFXIVPlayer extends User {
  @Column({ type: 'int', width: 11 })
  public apiId: number;

  @Column('varchar', { length: 255 })
  public charName: string;

  @CreateDateColumn('datetime')
  public firstSeenApi: Date;

  @Column('datetime')
  public lastSeenApi: Date;
}
