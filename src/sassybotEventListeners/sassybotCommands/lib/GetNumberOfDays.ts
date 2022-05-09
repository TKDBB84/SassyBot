import moment from 'moment';

const getNumberOFDays = (firstSeenApi: string | Date | moment.Moment): number => {
  const firstSeen = moment(firstSeenApi);
  if (firstSeen.isBefore('1900-01-01 00:00:00')) {
    return 0;
  }
  return moment().diff(firstSeen, 'd');
};
export default getNumberOFDays;
