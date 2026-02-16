import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("swarm-code")
  .description("Parallel AI coding agent orchestrator")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a swarm project")
  .action(initCommand);

program
  .command("run")
  .description("Run the swarm")
  .action(runCommand);

program
  .command("status")
  .description("Show swarm status")
  .action(statusCommand);

program
  .command("retry")
  .description("Retry failed work packages")
  .action(async () => {
    console.log("retry not yet implemented");
  });

program.parse();
