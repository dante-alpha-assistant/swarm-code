import { CodingAgent, AgentOptions, AgentResult } from './base';
import { execFileSync } from 'child_process';

export class ClaudeAgent extends CodingAgent {
  readonly name = 'claude';

  async spawn(opts: AgentOptions): Promise<AgentResult> {
    return this.runCommand('claude', [
      '-p', opts.prompt,
      '--allowedTools', 'Bash,Write,Edit,Read',
      '--output-format', 'text',
    ], opts);
  }

  async isAvailable(): Promise<boolean> {
    try {
      execFileSync('which', ['claude'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}
