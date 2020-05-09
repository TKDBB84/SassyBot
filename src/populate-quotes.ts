import Quote from './entity/Quote';
import { logger } from './log';
import { Sassybot } from './Sassybot';

const ONE_SECOND = 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function populateQuotes(sb: Sassybot) {
  const quoteManager = sb.dbConnection.getRepository<Quote>(Quote);
  const allQuotes = await quoteManager.find({ quoteText: '' });
  logger.info(`${allQuotes.length} to do...`);
  for (let i = 0, iMax = allQuotes.length; i < iMax; i++) {
    const quote = allQuotes[i];
    const message = await sb.getMessage(quote.channelId, quote.messageId);
    if (message) {
      await quoteManager.update(quote.id, { quoteText: message.cleanContent });
    }
    if ((i + 1) % 10 === 0) {
      logger.info(`${i + 1}/${allQuotes.length} complete`);
    }
    await sleep(ONE_SECOND);
  }
}
