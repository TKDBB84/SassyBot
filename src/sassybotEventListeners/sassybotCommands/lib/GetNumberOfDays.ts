import moment from 'moment';

const getNumberOFDays = (firstSeenApi: string | Date | moment.Moment): number => {
  const firstSeen = moment(firstSeenApi);
  const firstPull = moment(new Date(2019, 9, 11, 23, 59, 59));
  const beginningOfTime = moment(new Date(2019, 8, 2, 23, 59, 59));

  if (firstSeen.isBefore(beginningOfTime)) {
    return moment().diff(beginningOfTime, 'd');
  } else if (firstSeen.isAfter(beginningOfTime) && firstSeen.isBefore(firstPull)) {
    return moment().diff(beginningOfTime, 'd');
  } else {
    return moment().diff(firstSeen, 'd');
  }
};
export default getNumberOFDays;
