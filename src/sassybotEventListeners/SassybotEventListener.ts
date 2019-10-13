import { ISassybotEventListener, Sassybot } from '../Sassybot';

export default abstract class SassybotEventListener implements ISassybotEventListener {
  public abstract event: string;
  protected sb: Sassybot;
  constructor(sb: Sassybot) {
    this.sb = sb;
  }
  public abstract getEventListener(): (...args: any) => Promise<void>;
}
