import { LessThan } from 'typeorm';
import Event from './entity/Event';
import { Sassybot } from './Sassybot';
import AbsentRequest from './entity/AbsentRequest';

export type IJob = (sb: Sassybot) => Promise<void>;

export interface IScheduledJob {
  job: IJob;
  schedule: string;
}

const deletePastAbsences: IJob = async (sb: Sassybot) => {
  const absentRepo = sb.dbConnection.getRepository(AbsentRequest);
  const eventRepo = sb.dbConnection.getRepository(Event);
  const YESTERDAY = new Date();
  YESTERDAY.setTime(new Date().getTime() - 24 * (60 * 60 * 1000));
  await Promise.all([
    eventRepo.delete({ eventTime: LessThan<Date>(YESTERDAY) }),
    absentRepo.delete({ endDate: LessThan<Date>(YESTERDAY) }),
  ]);
};

const twiceADay = '0 15 8,20 * * *';
// const daily = '0 0 20 * * *';
// const afterTwiceADay = '0 30 8,20 * * *';
// const every15Min = '0 0,15,30,45 * * * *';

const jobs: IScheduledJob[] = [
  {
    job: deletePastAbsences,
    schedule: twiceADay,
  },
];

export default jobs;
