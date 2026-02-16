import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { saveConfig } from "../config.js";
import type { SwarmConfig } from "../types.js";

export async function initCommand(): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  const agentType = (await rl.question("Agent type (codex/claude/custom) [codex]: ")) || "codex";
  const maxStr = (await rl.question("Max concurrent agents [4]: ")) || "4";
  const model = (await rl.question("Model [gpt-4o]: ")) || "gpt-4o";

  rl.close();

  const config: SwarmConfig = {
    repo: "",
    branch: "main",
    model: agentType === "custom" ? model : agentType,
    maxConcurrent: parseInt(maxStr, 10) || 4,
    workPackages: [],
  };

  await saveConfig(config);
  console.log("Wrote .swarmrc.json");
}
