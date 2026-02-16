import { exec, log } from "./utils.js";
import type { WorkPackage } from "./types.js";

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

function ghEnv(token: string): Record<string, string> {
  return { ...process.env, GH_TOKEN: token } as Record<string, string>;
}

async function ghGraphQL(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<any> {
  const args = ["api", "graphql", "-f", `query=${query}`];
  if (variables) {
    for (const [k, v] of Object.entries(variables)) {
      args.push("-f", `${k}=${String(v)}`);
    }
  }
  const r = await execWithEnv("gh", args, token);
  if (r.exitCode !== 0) {
    throw new Error(`gh graphql failed: ${r.stderr}`);
  }
  return JSON.parse(r.stdout);
}

async function execWithEnv(
  cmd: string,
  args: string[],
  token: string,
  cwd?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { execFile } = await import("child_process");
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, GH_TOKEN: token } },
      (err, stdout, stderr) => {
        const exitCode =
          err && "code" in err ? ((err as any).code ?? 1) : err ? 1 : 0;
        resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode });
      }
    );
  });
}

export async function isGitHubAvailable(): Promise<boolean> {
  try {
    const r = await exec("which", ["gh"]);
    if (r.exitCode !== 0) return false;
    return !!process.env.GITHUB_TOKEN;
  } catch {
    return false;
  }
}

export async function createProjectBoard(
  config: GitHubConfig,
  title: string
): Promise<{
  projectId: string;
  url: string;
  statusFieldId: string;
  optionIds: { todo: string; inProgress: string; done: string };
}> {
  try {
    // Get owner node ID
    const ownerData = await ghGraphQL(
      config.token,
      `query($login: String!) { user(login: $login) { id } }`,
      { login: config.owner }
    );
    let ownerId = ownerData?.data?.user?.id;
    if (!ownerId) {
      const orgData = await ghGraphQL(
        config.token,
        `query($login: String!) { organization(login: $login) { id } }`,
        { login: config.owner }
      );
      ownerId = orgData?.data?.organization?.id;
    }
    if (!ownerId) throw new Error(`Could not find owner ID for ${config.owner}`);

    // Create project
    const createData = await ghGraphQL(
      config.token,
      `mutation($ownerId: ID!, $title: String!) {
        createProjectV2(input: { ownerId: $ownerId, title: $title }) {
          projectV2 { id url }
        }
      }`,
      { ownerId, title }
    );
    const project = createData.data.createProjectV2.projectV2;
    const projectId = project.id;
    const url = project.url;

    // Get status field and option IDs
    const fieldsData = await ghGraphQL(
      config.token,
      `query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id name options { id name }
                }
              }
            }
          }
        }
      }`,
      { projectId }
    );
    const fields = fieldsData.data.node.fields.nodes;
    const statusField = fields.find((f: any) => f.name === "Status" && f.options);
    if (!statusField) throw new Error("Status field not found");

    const findOption = (name: string) =>
      statusField.options.find((o: any) => o.name.toLowerCase().includes(name.toLowerCase()))?.id ?? "";

    // Create wave labels
    await ensureWaveLabels(config);

    return {
      projectId,
      url,
      statusFieldId: statusField.id,
      optionIds: {
        todo: findOption("todo"),
        inProgress: findOption("in progress"),
        done: findOption("done"),
      },
    };
  } catch (err) {
    log(`Warning: createProjectBoard failed: ${err}`);
    throw err;
  }
}

async function ensureWaveLabels(config: GitHubConfig): Promise<void> {
  const labels = [
    { name: "wave-1", color: "6366F1" },
    { name: "wave-2", color: "8B5CF6" },
    { name: "wave-3", color: "C084FC" },
  ];
  for (const label of labels) {
    await execWithEnv(
      "gh",
      ["label", "create", label.name, "--color", label.color, "--force", "-R", `${config.owner}/${config.repo}`],
      config.token
    );
  }
}

export async function createIssue(
  config: GitHubConfig,
  wp: WorkPackage
): Promise<{ number: number; nodeId: string }> {
  try {
    const r = await execWithEnv(
      "gh",
      [
        "issue",
        "create",
        "--title",
        `[${wp.id}] ${wp.name}`,
        "--body",
        wp.description || "No description",
        "-R",
        `${config.owner}/${config.repo}`,
        "--json",
        "number,id",
      ],
      config.token
    );
    if (r.exitCode !== 0) throw new Error(`gh issue create failed: ${r.stderr}`);
    // gh issue create --json doesn't work; parse URL from stdout
    // Actually gh issue create returns the URL. Let's get number from it.
    const urlMatch = r.stdout.trim().match(/\/issues\/(\d+)/);
    if (!urlMatch) throw new Error(`Could not parse issue number from: ${r.stdout}`);
    const number = parseInt(urlMatch[1], 10);

    // Get node ID via GraphQL
    const data = await ghGraphQL(
      config.token,
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) { id }
        }
      }`,
      { owner: config.owner, repo: config.repo, number: String(number) }
    );
    const nodeId = data.data.repository.issue.id;
    return { number, nodeId };
  } catch (err) {
    log(`Warning: createIssue failed: ${err}`);
    throw err;
  }
}

export async function addToProject(
  projectId: string,
  nodeId: string,
  token: string
): Promise<string> {
  try {
    const data = await ghGraphQL(
      token,
      `mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item { id }
        }
      }`,
      { projectId, contentId: nodeId }
    );
    return data.data.addProjectV2ItemById.item.id;
  } catch (err) {
    log(`Warning: addToProject failed: ${err}`);
    throw err;
  }
}

export async function updateStatus(
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
  token: string
): Promise<void> {
  try {
    await ghGraphQL(
      token,
      `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId, itemId: $itemId,
          fieldId: $fieldId,
          value: { singleSelectOptionId: $optionId }
        }) { projectV2Item { id } }
      }`,
      { projectId, itemId, fieldId, optionId }
    );
  } catch (err) {
    log(`Warning: updateStatus failed: ${err}`);
  }
}

export async function closeIssue(
  config: GitHubConfig,
  issueNumber: number
): Promise<void> {
  try {
    const r = await execWithEnv(
      "gh",
      ["issue", "close", String(issueNumber), "-R", `${config.owner}/${config.repo}`],
      config.token
    );
    if (r.exitCode !== 0) {
      log(`Warning: closeIssue failed: ${r.stderr}`);
    }
  } catch (err) {
    log(`Warning: closeIssue failed: ${err}`);
  }
}
