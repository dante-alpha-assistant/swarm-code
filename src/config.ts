import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SwarmConfig } from "./types.js";

const CONFIG_FILE = ".swarmrc.json";

export async function loadConfig(dir: string = process.cwd()): Promise<SwarmConfig | null> {
  try {
    const raw = await readFile(resolve(dir, CONFIG_FILE), "utf-8");
    return JSON.parse(raw) as SwarmConfig;
  } catch {
    return null;
  }
}

export async function saveConfig(config: SwarmConfig, dir: string = process.cwd()): Promise<void> {
  await writeFile(resolve(dir, CONFIG_FILE), JSON.stringify(config, null, 2) + "\n");
}
