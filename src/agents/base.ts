import { spawn } from 'child_process';

export interface AgentOptions {
  workdir: string;
  prompt: string;
  timeout?: number; // ms, default 30 min
  env?: Record<string, string>;
}

export interface AgentResult {
  success: boolean;
  exitCode: number;
  output: string;
  duration: number; // ms
}

const DEFAULT_TIMEOUT = 30 * 60 * 1000;

export abstract class CodingAgent {
  abstract readonly name: string;

  abstract spawn(opts: AgentOptions): Promise<AgentResult>;

  abstract isAvailable(): Promise<boolean>;

  protected runCommand(command: string, args: string[], opts: AgentOptions): Promise<AgentResult> {
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    const start = Date.now();

    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: opts.workdir,
        env: { ...process.env, ...opts.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      const chunks: Buffer[] = [];
      child.stdout.on('data', (d: Buffer) => chunks.push(d));
      child.stderr.on('data', (d: Buffer) => chunks.push(d));

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000);
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        const output = Buffer.concat(chunks).toString('utf-8');
        const exitCode = code ?? 1;
        resolve({
          success: exitCode === 0,
          exitCode,
          output,
          duration: Date.now() - start,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          exitCode: 1,
          output: err.message,
          duration: Date.now() - start,
        });
      });
    });
  }
}
