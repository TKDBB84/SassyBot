import { Column, Entity, getManager, ManyToOne, MoreThanOrEqual, PrimaryGeneratedColumn } from 'typeorm';
import SbUser from './SbUser';

@Entity()
export default class Event {
  public static async getAll(guildId: string): Promise<Event[]> {
    const eventRepo = getManager().getRepository<Event>(Event);
    return eventRepo.find({
      order: { eventTime: 'ASC' },
      where: { eventTime: MoreThanOrEqual<Date>(new Date()), guildId },
    });
  }

  public static async findByName(name: string, guildId: string): Promise<Event | undefined> {
    const eventRepo = getManager().getRepository<Event>(Event);
    return eventRepo.findOne({
      where: { eventName: name, eventTime: MoreThanOrEqual<Date>(new Date()), guildId },
    });
  }

  public static async delete(id: number): Promise<true> {
    const eventRepo = getManager().getRepository<Event>(Event);
    return !!(await eventRepo.delete(id));
  }

  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public guildId!: string;

  @Column()
  public eventName!: string;

  @ManyToOne(
    () => SbUser,
    (user) => user.events,
    { eager: true },
  )
  public user!: SbUser;

  @Column()
  public eventTime!: Date;
}
