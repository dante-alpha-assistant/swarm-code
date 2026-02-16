import { WorkPackage } from "./types.js";
import { gatherContext } from "./context.js";
import { DECOMPOSE_SYSTEM_PROMPT } from "./prompts/decompose.js";
import { log } from "./utils.js";

export interface DecomposeOpts {
  prompt: string;
  repoPath: string;
  maxPackages?: number;
  model?: string;
}

export async function decompose(opts: DecomposeOpts): Promise<WorkPackage[]> {
  const { prompt, repoPath, maxPackages = 8, model = "gpt-4o" } = opts;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  log("Gathering codebase context...");
  const context = await gatherContext(repoPath);

  const userMessage = `## Codebase Context\n${context}\n\n## Task\n${prompt}\n\nDecompose into at most ${maxPackages} work packages. Output JSON only.`;

  log(`Calling ${model} for task decomposition...`);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: DECOMPOSE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const raw = data.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Empty response from OpenAI API");
  }

  // Strip markdown fences if the model wraps anyway
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  let packages: WorkPackage[];
  try {
    packages = JSON.parse(cleaned) as WorkPackage[];
  } catch (e) {
    throw new Error(`Failed to parse LLM output as JSON: ${(e as Error).message}\nRaw: ${raw}`);
  }

  if (!Array.isArray(packages)) {
    throw new Error("LLM output is not an array");
  }

  // Validate and normalize
  for (const wp of packages) {
    if (!wp.id || !wp.name || !wp.description || !wp.branch) {
      throw new Error(`Invalid work package: missing required fields in ${JSON.stringify(wp)}`);
    }
    wp.status = "pending";
    wp.dependencies = wp.dependencies ?? [];
  }

  log(`Decomposed into ${packages.length} work packages`);
  return packages;
}
