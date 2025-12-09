import type { Sassybot } from './Sassybot';
export type IJob = (sb: Sassybot) => Promise<void>;

export interface IScheduledJob {
  job: IJob;
  schedule: string;
}

const jobs: IScheduledJob[] = [];

export default jobs;
