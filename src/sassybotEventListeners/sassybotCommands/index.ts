import ClaimCommand from './ClaimCommand';
import AbsentCommand from './CotActivityCommands/AbsentCommand';
import PromoteCommand from './CotActivityCommands/PromoteCommand';
import EchoCommand from './EchoCommand';
import EvalCommand from './EvalCommand';
import PingCommand from './PingCommand';
import QuoteCommand from './QuoteCommand';
import RollCommand from './RollCommand';
import SpamCommand from './SpamCommand';

export { default as ClaimCommand } from './ClaimCommand';
export { default as EchoCommand } from './EchoCommand';
export { default as PingCommand } from './PingCommand';
export { default as QuoteCommand } from './QuoteCommand';
export { default as RollCommand } from './RollCommand';
export { default as SpamCommand } from './SpamCommand';
export { default as EvalCommand } from './EvalCommand';

export default [
  AbsentCommand,
  ClaimCommand,
  EchoCommand,
  EvalCommand,
  PingCommand,
  PromoteCommand,
  QuoteCommand,
  RollCommand,
  SpamCommand,
];
