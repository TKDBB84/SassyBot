import { ISassybotEventListener, Sassybot } from '../Sassybot';

export default abstract class SassybotEventListener implements ISassybotEventListener {
  protected sb: Sassybot;
  protected abstract event: string;
  constructor(sb: Sassybot) {
    this.sb = sb;
  }
  public readonly init = (sb: Sassybot) => {
    const eventListener = this.getEventListener();
    sb.on(this.event, eventListener);
  };
  protected abstract getEventListener(): (...args: any) => Promise<void>;
}
