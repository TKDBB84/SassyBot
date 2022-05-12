import { DataSource } from 'typeorm';
import AbsentRequest from './entity/AbsentRequest';
import COTMember from './entity/COTMember';
import Event from './entity/Event';
import FFXIVChar from './entity/FFXIVChar';
import PromotionRequest from './entity/PromotionRequest';
import Quote from './entity/Quote';
import SbUser from './entity/SbUser';
import SpamChannel from './entity/SpamChannel';

const dataSource = new DataSource({
  type: 'mariadb',
  host: process.env.TYPEORM_HOST,
  port: 3306,
  username: process.env.TYPEORM_USERNAME,
  password: process.env.TYPEORM_PASSWORD,
  database: process.env.TYPEORM_DATABASE,
  synchronize: false,
  logging: false,
  entities: [AbsentRequest, COTMember, Event, FFXIVChar, PromotionRequest, Quote, SbUser, SpamChannel],
});

export default async function getDataSource(): Promise<DataSource> {
  return await dataSource.initialize();
}
