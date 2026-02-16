import * as fs from "fs";
import * as path from "path";
import { SwarmState } from "./types";

const STATE_DIR = ".swarm-code";
const STATE_FILE = "state.json";

function statePath(repoPath: string): string {
  return path.join(repoPath, STATE_DIR, STATE_FILE);
}

export function saveState(repoPath: string, state: SwarmState): void {
  const dir = path.join(repoPath, STATE_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(statePath(repoPath), JSON.stringify(state, null, 2), "utf-8");
}

export function loadState(repoPath: string): SwarmState | null {
  const p = statePath(repoPath);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as SwarmState;
  } catch {
    return null;
  }
}
