import { DataSource } from 'typeorm';
import Event from './entity/Event';
import Quote from './entity/Quote';
import SbUser from './entity/SbUser';
import SpamChannel from './entity/SpamChannel';
import { logger } from './log';

const dataSource = new DataSource({
  type: 'mariadb',
  host: process.env.TYPEORM_HOST,
  port: 3306,
  username: process.env.TYPEORM_USERNAME,
  password: process.env.TYPEORM_PASSWORD,
  database: process.env.TYPEORM_DATABASE,
  synchronize: false,
  logging: false,
  entities: [Event, Quote, SbUser, SpamChannel],
});

export default async function getDataSource(): Promise<DataSource> {
  if (!dataSource.isInitialized) {
    logger.info('Initializing DataSource...');
    await dataSource.initialize();
    logger.info('DataSource Ready...');
  }
  return dataSource;
}
