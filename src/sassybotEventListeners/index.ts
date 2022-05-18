import CoTNewMemberListener from './CoTNewMemberListener';
import GamezzEyeListenerListener from './GamezzEyeListener';
import QuoteListener from './QuoteListener';
import VoiceLogListener from './VoiceLogListener';
import sassyBotCommands from './sassybotCommands';

export default [CoTNewMemberListener,GamezzEyeListenerListener, QuoteListener, VoiceLogListener, ...sassyBotCommands];
