import moment from 'moment';

const getNumberOFDays = (firstSeenApi: string | Date | moment.Moment): number => {
  return moment().diff(moment(firstSeenApi), 'd');
};
export default getNumberOFDays;
