import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadConfig } from "../config.js";
import { decompose } from "../decompose.js";
import { orchestrate } from "../orchestrator.js";
import { isGitHubAvailable, createProjectBoard, createIssue, addToProject } from "../github.js";
import { showPlan, showProgress, showSummary } from "../display.js";

export async function runCommand(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Error: .swarmrc.json not found. Run `swarm-code init` first.");
    process.exit(1);
  }

  const prompt = process.argv.slice(3).join(" ");
  if (!prompt) {
    console.error("Error: provide a prompt. Usage: swarm-code run <prompt>");
    process.exit(1);
  }

  const repoPath = process.cwd();
  const packages = await decompose({ prompt, repoPath, model: config.model });

  showPlan(packages);

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question("Proceed? (y/n) ");
  rl.close();

  if (answer.toLowerCase() !== "y") {
    console.log("Aborted.");
    return;
  }

  // GitHub integration
  if (await isGitHubAvailable()) {
    try {
      const token = process.env.GITHUB_TOKEN!;
      const remote = config.repo;
      const match = remote.match(/github\.com[/:](.+?)\/(.+?)(?:\.git)?$/);
      if (match) {
        const ghConfig = { token, owner: match[1], repo: match[2] };
        const board = await createProjectBoard(ghConfig, `Swarm: ${prompt.slice(0, 50)}`);
        console.log(`GitHub project: ${board.url}`);

        for (const wp of packages) {
          const issue = await createIssue(ghConfig, wp);
          await addToProject(board.projectId, issue.nodeId, token);
        }
      }
    } catch (err) {
      console.error(`GitHub integration error (continuing): ${err}`);
    }
  }

  const state = await orchestrate({
    config,
    packages,
    repoPath,
    onProgress: showProgress,
  });

  showSummary(state);
}
