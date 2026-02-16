import { CodingAgent, AgentOptions, AgentResult } from './base';
import { CodexAgent } from './codex';
import { ClaudeAgent } from './claude';

export class CustomAgent extends CodingAgent {
  readonly name = 'custom';
  private readonly commandTemplate: string;

  constructor(commandTemplate: string) {
    super();
    this.commandTemplate = commandTemplate;
  }

  async spawn(opts: AgentOptions): Promise<AgentResult> {
    const cmd = this.commandTemplate
      .replace(/\{prompt\}/g, opts.prompt)
      .replace(/\{workdir\}/g, opts.workdir);
    return this.runCommand('sh', ['-c', cmd], opts);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

export type AgentType = 'codex' | 'claude' | 'custom';

export function createAgent(type: AgentType, customCommand?: string): CodingAgent {
  switch (type) {
    case 'codex':
      return new CodexAgent();
    case 'claude':
      return new ClaudeAgent();
    case 'custom':
      if (!customCommand) throw new Error('customCommand required for custom agent');
      return new CustomAgent(customCommand);
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
}
