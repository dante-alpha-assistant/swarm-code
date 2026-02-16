# 🐝 swarm-code

**Parallel autonomous coding agents. One prompt, many workers.**

swarm-code decomposes coding tasks into work packages using an LLM, then executes them in parallel using autonomous coding agents — Codex, Claude Code, or any custom command. Each agent works in an isolated git worktree, and everything merges back automatically when done.

## Quick Start

```bash
npx swarm-code init
npx swarm-code run "add dark mode with a settings toggle"
```

## How It Works

```
Prompt → Decompose (LLM) → Work Packages → Parallel Agents → Git Merge → Done
```

1. You describe a task in plain English
2. An LLM breaks it into independent work packages with dependency info
3. Agents execute packages in parallel waves (dependencies first)
4. Each agent works in its own git worktree — full isolation
5. Results merge back into your branch

## Features

- **Parallel execution** — up to 8 agents running simultaneously
- **Git worktree isolation** — each agent gets its own working copy
- **Pluggable agents** — Codex CLI, Claude Code CLI, or any custom command
- **Wave-based dependencies** — packages execute in the right order
- **Automatic retry** — failed packages retry before giving up
- **GitHub Projects tracking** — optional project board integration

## Supported Agents

| Agent | Command | Notes |
|-------|---------|-------|
| Codex CLI | `codex` | OpenAI's coding agent |
| Claude Code CLI | `claude` | Anthropic's coding agent |
| Custom | any command | Bring your own agent |

```json
{
  "agent": "codex",
  "agentCommand": "codex --approve-mode full-auto -q"
}
```

Or use Claude Code:

```json
{
  "agent": "claude",
  "agentCommand": "claude -p --allowedTools Edit Read Bash"
}
```

Or anything else:

```json
{
  "agent": "custom",
  "agentCommand": "my-agent --auto"
}
```

## Configuration

Create `.swarmrc.json` in your project root:

```json
{
  "agent": "codex",
  "agentCommand": "codex --approve-mode full-auto -q",
  "model": "o3",
  "maxConcurrency": 4,
  "retries": 2,
  "github": {
    "enabled": false,
    "projectNumber": 1,
    "owner": "your-org",
    "repo": "your-repo"
  },
  "worktreeBase": ".swarm-worktrees",
  "mergeStrategy": "ort"
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `agent` | `"codex"` | Agent type: `codex`, `claude`, or `custom` |
| `agentCommand` | — | Full command to invoke the agent |
| `model` | `"o3"` | LLM model for decomposition |
| `maxConcurrency` | `4` | Max parallel agents (1–8) |
| `retries` | `2` | Retry count for failed packages |
| `github.enabled` | `false` | Enable GitHub Projects tracking |
| `worktreeBase` | `".swarm-worktrees"` | Where worktrees are created |
| `mergeStrategy` | `"ort"` | Git merge strategy |

## GitHub Integration

Enable optional project board tracking to visualize progress:

```json
{
  "github": {
    "enabled": true,
    "projectNumber": 1,
    "owner": "your-org",
    "repo": "your-repo"
  }
}
```

Work packages appear as project items, moving through columns as they execute. Requires a `GITHUB_TOKEN` with project permissions.

## vs Alternatives

| | swarm-code | Single-agent CLI | IDE copilots |
|---|---|---|---|
| Parallel execution | ✅ Up to 8 agents | ❌ Sequential | ❌ One suggestion |
| Model choice | ✅ BYO model | ⚠️ Vendor-locked | ⚠️ Vendor-locked |
| Git isolation | ✅ Worktrees | ❌ Shared state | ❌ Shared state |
| Open source | ✅ MIT | Varies | ❌ |
| CLI-native | ✅ | ✅ | ❌ GUI-only |

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b my-feature`
3. Make changes and add tests
4. Run `npm test` and `npm run lint`
5. Open a PR

## License

[MIT](LICENSE) © 2026 Dante Perea
