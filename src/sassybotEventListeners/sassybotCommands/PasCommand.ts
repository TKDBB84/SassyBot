import SassybotCommand from './SassybotCommand';

export default class PasCommand extends SassybotCommand {
  public readonly commands = ['pas'];

  public getHelpText(): string {
    return 'NTSH';
  }

  protected async listener(): Promise<void> {
    const channel = await this.sb.getTextChannel('331196148079394836');
    await channel?.send({
      content: 'No, you shut the fuck up and deal with the promotions..... fucking whiner.',
      reply: { messageReference: '1074058437144612914' },
    });
  }
}
