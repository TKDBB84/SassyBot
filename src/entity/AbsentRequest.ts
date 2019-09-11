import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { COTMember } from './COTMember';

@Entity()
export class AbsentRequest {
  @PrimaryGeneratedColumn()
  public id!: number;

  @CreateDateColumn('datetime')
  public requested!: Date;

  @Column('date')
  public startDate!: Date;

  @Column('date')
  public endDate!: Date;

  @ManyToOne((type) => COTMember, (cotMember) => cotMember.promotions, { eager: true })
  public CotMember!: COTMember;
}
