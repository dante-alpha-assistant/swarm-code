import * as path from "path";
import { exec, log, ExecResult } from "./utils";

const WORKTREE_BASE = "/tmp/swarm-code";

function worktreePath(project: string, wpId: string): string {
  return path.join(WORKTREE_BASE, project, wpId);
}

function branchName(wpId: string, name: string): string {
  return `swarm/${wpId}/${name}`;
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

/**
 * Create a new worktree with a new branch.
 */
export async function createWorktree(
  repoDir: string,
  project: string,
  wpId: string,
  name: string
): Promise<{ worktreePath: string; branch: string }> {
  const wtPath = worktreePath(project, wpId);
  const branch = branchName(wpId, name);
  log(`Creating worktree ${wtPath} on branch ${branch}`);
  const res = await exec("git", ["worktree", "add", "-b", branch, wtPath], repoDir);
  if (res.exitCode !== 0) {
    throw new Error(`Failed to create worktree: ${res.stderr}`);
  }
  return { worktreePath: wtPath, branch };
}

/**
 * List all worktrees for the repo.
 */
export async function listWorktrees(repoDir: string): Promise<WorktreeInfo[]> {
  const res = await exec("git", ["worktree", "list", "--porcelain"], repoDir);
  if (res.exitCode !== 0) {
    throw new Error(`Failed to list worktrees: ${res.stderr}`);
  }
  const entries: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};
  for (const line of res.stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      current.path = line.slice(9);
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice(5);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line === "") {
      if (current.path) {
        entries.push({
          path: current.path,
          branch: current.branch ?? "",
          head: current.head ?? "",
        });
      }
      current = {};
    }
  }
  return entries;
}

/**
 * Merge a worktree branch into the target branch (default: main).
 * Returns conflict file list on failure, or null on success.
 */
export async function mergeWorktree(
  repoDir: string,
  wpId: string,
  name: string,
  targetBranch = "main"
): Promise<{ success: true } | { success: false; conflicts: string[] }> {
  const branch = branchName(wpId, name);
  log(`Merging ${branch} into ${targetBranch}`);

  // checkout target
  let res = await exec("git", ["checkout", targetBranch], repoDir);
  if (res.exitCode !== 0) {
    throw new Error(`Failed to checkout ${targetBranch}: ${res.stderr}`);
  }

  res = await exec("git", ["merge", "--no-edit", branch], repoDir);
  if (res.exitCode === 0) {
    return { success: true };
  }

  // get conflict list
  const diffRes = await exec("git", ["diff", "--name-only", "--diff-filter=U"], repoDir);
  const conflicts = diffRes.stdout.trim().split("\n").filter(Boolean);

  // abort merge
  await exec("git", ["merge", "--abort"], repoDir);

  return { success: false, conflicts };
}

/**
 * Remove a worktree and delete its branch.
 */
export async function removeWorktree(
  repoDir: string,
  project: string,
  wpId: string,
  name: string
): Promise<void> {
  const wtPath = worktreePath(project, wpId);
  const branch = branchName(wpId, name);
  log(`Removing worktree ${wtPath} and branch ${branch}`);

  await exec("git", ["worktree", "remove", "--force", wtPath], repoDir);
  await exec("git", ["branch", "-D", branch], repoDir);
}

/**
 * Cleanup all swarm worktrees and their branches.
 */
export async function cleanupAllWorktrees(repoDir: string): Promise<void> {
  const worktrees = await listWorktrees(repoDir);
  for (const wt of worktrees) {
    if (wt.branch.startsWith("swarm/")) {
      log(`Cleaning up ${wt.path} (${wt.branch})`);
      await exec("git", ["worktree", "remove", "--force", wt.path], repoDir);
      await exec("git", ["branch", "-D", wt.branch], repoDir);
    }
  }
  await exec("git", ["worktree", "prune"], repoDir);
}
