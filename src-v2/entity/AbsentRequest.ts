import {PrimaryGeneratedColumn, Entity, ManyToOne, JoinColumn, CreateDateColumn, Column} from 'typeorm';
import {COTMember, CotRanks} from "./COTMember";

@Entity()
export class AbsentRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn('datetime')
  requested: Date;

  @Column('date')
  startDate: Date;

  @Column('date')
  endDate: Date;

  @ManyToOne((type) => COTMember, (cotMember) => cotMember.promotions, { eager: true })
  CotMember: COTMember;
}
