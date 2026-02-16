import { SwarmConfig, WorkPackage, SwarmState } from "./types";
import { createWorktree, mergeWorktree, removeWorktree } from "./git";
import { createAgent } from "./agents/factory";
import { log } from "./utils";
import { saveState } from "./tracker";
import * as path from "path";

export interface OrchestratorOptions {
  config: SwarmConfig;
  packages: WorkPackage[];
  repoPath: string;
  onProgress?: (event: ProgressEvent) => void;
}

export interface ProgressEvent {
  type: "wave-start" | "wp-start" | "wp-done" | "wp-failed" | "wave-done" | "all-done";
  wave?: number;
  wp?: WorkPackage;
  message: string;
}

const MAX_RETRIES = 2;

/** Simple concurrency limiter */
function createSemaphore(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (active < limit) {
      active++;
      return;
    }
    return new Promise<void>((resolve) => {
      queue.push(() => {
        active++;
        resolve();
      });
    });
  }

  function release(): void {
    active--;
    const next = queue.shift();
    if (next) next();
  }

  return { acquire, release };
}

/** Compute wave number for each WP based on dependency graph */
function assignWaves(packages: WorkPackage[]): Map<string, number> {
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

export async function orchestrate(opts: OrchestratorOptions): Promise<SwarmState> {
  const { config, packages, repoPath, onProgress } = opts;
  const emit = onProgress ?? (() => {});

  const project = path.basename(repoPath);
  const agent = createAgent(config.model as any);
  const sem = createSemaphore(config.maxConcurrent);

  // Clone packages for mutation
  const wps: WorkPackage[] = packages.map((wp) => ({ ...wp }));
  const wpById = new Map(wps.map((wp) => [wp.id, wp]));

  const waveMap = assignWaves(wps);
  const maxWave = Math.max(...waveMap.values(), 0);

  const state: SwarmState = {
    config,
    workPackages: wps,
    startedAt: new Date().toISOString(),
  };

  for (let wave = 1; wave <= maxWave; wave++) {
    const waveWps = wps.filter((wp) => waveMap.get(wp.id) === wave);
    emit({ type: "wave-start", wave, message: `Wave ${wave}: ${waveWps.length} work packages` });

    const tasks = waveWps.map(async (wp) => {
      // Check if deps all succeeded
      const depsFailed = wp.dependencies.some((d) => wpById.get(d)?.status === "failed");
      if (depsFailed) {
        wp.status = "failed";
        wp.error = "Dependency failed";
        emit({ type: "wp-failed", wave, wp, message: `WP ${wp.id}: dependency failed` });
        return;
      }

      let attempts = 0;
      let success = false;

      while (attempts <= MAX_RETRIES && !success) {
        attempts++;
        await sem.acquire();
        try {
          wp.status = "running";
          emit({ type: "wp-start", wave, wp, message: `WP ${wp.id}: starting (attempt ${attempts})` });

          const { worktreePath, branch } = await createWorktree(repoPath, project, wp.id, wp.name);

          const prompt = `${wp.description}\n\nWorking dir: ${worktreePath}. After done: git add -A && git commit -m 'WP-${wp.id}: ${wp.name}'`;

          const result = await agent.spawn({ workdir: worktreePath, prompt });

          if (result.success) {
            const mergeResult = await mergeWorktree(repoPath, wp.id, wp.name, config.branch);
            if (mergeResult.success) {
              wp.status = "done";
              success = true;
              emit({ type: "wp-done", wave, wp, message: `WP ${wp.id}: done` });
            } else {
              wp.error = `Merge conflicts: ${mergeResult.conflicts.join(", ")}`;
              log(`WP ${wp.id} merge failed: ${wp.error}`);
            }
          } else {
            wp.error = `Agent exited ${result.exitCode}`;
            log(`WP ${wp.id} agent failed: ${wp.error}`);
          }

          // Cleanup worktree
          try {
            await removeWorktree(repoPath, project, wp.id, wp.name);
          } catch (e) {
            log(`Worktree cleanup failed for ${wp.id}: ${e}`);
          }
        } finally {
          sem.release();
        }
      }

      if (!success) {
        wp.status = "failed";
        emit({ type: "wp-failed", wave, wp, message: `WP ${wp.id}: failed after ${attempts} attempts` });
      }

      saveState(repoPath, state);
    });

    await Promise.allSettled(tasks);
    emit({ type: "wave-done", wave, message: `Wave ${wave} complete` });
    saveState(repoPath, state);
  }

  state.completedAt = new Date().toISOString();
  emit({ type: "all-done", message: "All waves complete" });
  saveState(repoPath, state);

  return state;
}
