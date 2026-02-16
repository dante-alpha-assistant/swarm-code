import { CodingAgent, AgentOptions, AgentResult } from './base';
import { execFileSync } from 'child_process';

export class CodexAgent extends CodingAgent {
  readonly name = 'codex';

  async spawn(opts: AgentOptions): Promise<AgentResult> {
    return this.runCommand('codex', ['exec', '--full-auto', opts.prompt], opts);
  }

  async isAvailable(): Promise<boolean> {
    try {
      execFileSync('which', ['codex'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
