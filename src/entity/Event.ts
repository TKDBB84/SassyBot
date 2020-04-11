import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export default class Event {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public guildId!: string;

  @Column()
  public eventName!: string;

  @Column()
  public eventTime!: Date;
}
