import CoTNewMemberListener from './CoTNewMemberListener';
import GamezzEyeListenerListener from './GamezzEyeListener';
import QuoteListener from './QuoteListener';
import sassyBotCommands from './sassybotCommands';
import VoiceLogListener from './VoiceLogListener';

export default [CoTNewMemberListener, GamezzEyeListenerListener, QuoteListener, ...sassyBotCommands, VoiceLogListener];
