import { ChildEntity, Column, CreateDateColumn } from 'typeorm';
import { User } from './User';

@ChildEntity()
export class FFXIVPlayer extends User {
  @Column({ type: 'int', width: 11 })
  apiId: number;

  @Column('varchar', { length: 255 })
  charName: string;

  @CreateDateColumn('datetime')
  firstSeenApi: Date;

  @Column('datetime')
  lastSeenApi: Date;
}
