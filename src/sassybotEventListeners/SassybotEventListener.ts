import type { ISassybotEventListener, Sassybot, SassybotEvent } from '../Sassybot';

export default abstract class SassybotEventListener implements ISassybotEventListener {
  protected sb: Sassybot;
  protected constructor(sb: Sassybot, event: SassybotEvent) {
    this.sb = sb;
    //eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.sb.on(event, (...args) => {
      //eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      void this.getEventListener().bind(this)(...args);
    });
  }

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  public abstract getEventListener(): (...args: any[]) => Promise<void>;
}
