import { execFile } from "child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function exec(
  cmd: string,
  args: string[],
  cwd?: string
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const exitCode = err && "code" in err ? (err as any).code ?? 1 : err ? 1 : 0;
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode });
    });
  });
}

export function log(msg: string): void {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ${msg}`);
}
