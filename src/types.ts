export interface SwarmConfig {
  repo: string;
  branch: string;
  model: string;
  maxConcurrent: number;
  workPackages: WorkPackage[];
}

export interface WorkPackage {
  id: string;
  name: string;
  description: string;
  branch: string;
  dependencies: string[];
  status: "pending" | "running" | "done" | "failed";
  agent?: string;
  error?: string;
}

export interface SwarmState {
  config: SwarmConfig;
  workPackages: WorkPackage[];
  startedAt?: string;
  completedAt?: string;
}
