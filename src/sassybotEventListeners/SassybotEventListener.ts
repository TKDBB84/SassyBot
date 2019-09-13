import { ISassybotEventListener, Sassybot } from '../Sassybot';

export default abstract class SassybotEventListener implements ISassybotEventListener {
  protected sb: Sassybot;
  protected abstract event: string;
  protected abstract onEvent: (...args: any) => Promise<void>;

  constructor(sb: Sassybot) {
    this.sb = sb;
  }
  public readonly init = () => {
    this.sb.on(this.event, this.onEvent.bind(this));
  };
}
