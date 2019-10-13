import { ISassybotEventListener, Sassybot } from '../Sassybot';

export default abstract class SassybotEventListener implements ISassybotEventListener {
  protected sb: Sassybot;
  protected abstract event: string;
  protected abstract getEventListener: () => ((...args: any) => Promise<void>);

  constructor(sb: Sassybot) {
    this.sb = sb;
  }
  public readonly init = (sb: Sassybot) => {
    const eventListener = this.getEventListener();
    sb.on(this.event, eventListener);
  };
}
