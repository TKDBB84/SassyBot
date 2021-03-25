import CoTNewMemberListener from './CoTNewMemberListener';
import QuoteListener from './QuoteListener';
import sassyBotCommands from './sassybotCommands';
import VoiceLogListener from './VoiceLogListener';

export default [CoTNewMemberListener, QuoteListener, ...sassyBotCommands, VoiceLogListener];
