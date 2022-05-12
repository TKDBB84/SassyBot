import { Column, Entity, ManyToOne, MoreThanOrEqual, PrimaryGeneratedColumn } from 'typeorm';
import SbUser from './SbUser';
import getDataSource from '../dataSource';

@Entity()
export default class Event {
  public static async getAll(guildId: string): Promise<Event[]> {
    const dataSource = await getDataSource();
    const FOUR_HOURS_AGO = new Date();
    FOUR_HOURS_AGO.setTime(new Date().getTime() - 4 * (60 * 60 * 1000));
    const eventRepo = dataSource.getRepository<Event>(Event);
    return eventRepo.find({
      order: { eventTime: 'ASC' },
      where: { eventTime: MoreThanOrEqual<Date>(FOUR_HOURS_AGO), guildId },
    });
  }

  public static async findByName(name: string, guildId: string): Promise<Event | null> {
    const FOUR_HOURS_AGO = new Date();
    FOUR_HOURS_AGO.setTime(new Date().getTime() - 4 * (60 * 60 * 1000));
    const dataSource = await getDataSource();
    const eventRepo = dataSource.getRepository<Event>(Event);
    return eventRepo.findOne({
      where: { eventName: name, eventTime: MoreThanOrEqual<Date>(FOUR_HOURS_AGO), guildId },
    });
  }

  public static async delete(id: number): Promise<true> {
    const dataSource = await getDataSource();
    const eventRepo = dataSource.getRepository<Event>(Event);
    return !!(await eventRepo.delete(id));
  }

  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public guildId!: string;

  @Column()
  public eventName!: string;

  @ManyToOne(() => SbUser, (user) => user.events, { eager: true })
  public user!: SbUser;

  @Column()
  public eventTime!: Date;
  //
  // @Column({
  //   type: 'enum',
  //   enum:
  //   default:
  // })
  // public reoccuring!:
}
