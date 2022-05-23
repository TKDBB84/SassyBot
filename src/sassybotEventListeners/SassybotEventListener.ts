import type { ISassybotEventListener, Sassybot, SassybotEvent } from '../Sassybot';

export default abstract class SassybotEventListener implements ISassybotEventListener {
  public abstract event: SassybotEvent;
  protected sb: Sassybot;
  constructor(sb: Sassybot) {
    this.sb = sb;
    //eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.sb.on(this.getEvent(), (...args) => {
      //eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      void this.getEventListener().bind(this)(...args);
    });
  }
  public getEvent(): string {
    return this.event;
  }

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  public abstract getEventListener(): (...args: any[]) => Promise<void>;
}
