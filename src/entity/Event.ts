import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import SbUser from "./SbUser";

@Entity()
export default class Event {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public guildId!: string;

  @Column()
  public eventName!: string;

  @ManyToOne(
    () => SbUser,
    (user) => user.events
  )
  public user!: SbUser;

  @Column()
  public eventTime!: Date;
}
