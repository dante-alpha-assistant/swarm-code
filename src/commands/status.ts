import { loadState } from "../tracker.js";
import { showSummary } from "../display.js";

export async function statusCommand(): Promise<void> {
  const repoPath = process.cwd();
  const state = loadState(repoPath);

  if (!state) {
    console.log("No swarm state found. Run `swarm-code run` first.");
    return;
  }

  showSummary(state);
}
