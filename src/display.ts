import chalk from "chalk";
import type { WorkPackage, SwarmState } from "./types.js";
import type { ProgressEvent } from "./orchestrator.js";

/** Compute wave number for each WP based on dependencies */
function computeWaves(packages: WorkPackage[]): Map<string, number> {
  const waveMap = new Map<string, number>();
  function getWave(wpId: string): number {
    if (waveMap.has(wpId)) return waveMap.get(wpId)!;
    const wp = packages.find((p) => p.id === wpId);
    if (!wp || wp.dependencies.length === 0) {
      waveMap.set(wpId, 1);
      return 1;
    }
    const maxDep = Math.max(...wp.dependencies.map((d) => getWave(d)));
    const wave = maxDep + 1;
    waveMap.set(wpId, wave);
    return wave;
  }
  for (const wp of packages) getWave(wp.id);
  return waveMap;
}

export function showPlan(packages: WorkPackage[]): void {
  const waveMap = computeWaves(packages);
  const maxWave = Math.max(...waveMap.values(), 0);

  console.log(chalk.bold("\n📋 Decomposition Plan\n"));

  for (let w = 1; w <= maxWave; w++) {
    const waveWps = packages.filter((wp) => waveMap.get(wp.id) === w);
    console.log(chalk.cyan.bold(`  Wave ${w}`));
    for (const wp of waveWps) {
      const deps = wp.dependencies.length > 0 ? chalk.gray(` (deps: ${wp.dependencies.join(", ")})`) : "";
      console.log(`    ${chalk.white(wp.id)} ${wp.name}${deps}`);
    }
    console.log();
  }
}

export function showProgress(event: ProgressEvent): void {
  switch (event.type) {
    case "wave-start":
      console.log(chalk.cyan.bold(`\n🌊 ${event.message}`));
      break;
    case "wp-start":
      console.log(chalk.yellow(`  ▶ ${event.message}`));
      break;
    case "wp-done":
      console.log(chalk.green(`  ✅ ${event.message}`));
      break;
    case "wp-failed":
      console.log(chalk.red(`  ❌ ${event.message}`));
      break;
    case "wave-done":
      console.log(chalk.cyan(`  ── ${event.message}`));
      break;
    case "all-done":
      console.log(chalk.green.bold(`\n🎉 ${event.message}\n`));
      break;
  }
}

export function showSummary(state: SwarmState): void {
  console.log(chalk.bold("\n📊 Summary\n"));

  const header = `  ${"WP".padEnd(8)} ${"Name".padEnd(30)} ${"Status".padEnd(10)}`;
  console.log(chalk.underline(header));

  for (const wp of state.workPackages) {
    const statusColor = wp.status === "done" ? chalk.green : wp.status === "failed" ? chalk.red : chalk.yellow;
    const line = `  ${wp.id.padEnd(8)} ${wp.name.padEnd(30)} ${statusColor(wp.status.padEnd(10))}`;
    console.log(line);
  }

  const done = state.workPackages.filter((wp) => wp.status === "done").length;
  const failed = state.workPackages.filter((wp) => wp.status === "failed").length;
  const total = state.workPackages.length;

  console.log();
  console.log(`  ${chalk.green(`${done} passed`)} / ${chalk.red(`${failed} failed`)} / ${total} total`);

  if (state.startedAt && state.completedAt) {
    const duration = (new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime()) / 1000;
    console.log(`  Duration: ${duration.toFixed(1)}s`);
  }
  console.log();
}
