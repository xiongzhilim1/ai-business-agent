/**
 * smoke_providers.ts — Demonstrate the interface layer: the SAME Agent runs on
 * different providers chosen at runtime, with zero changes to the loop or tools.
 *
 * We run against the sandbox OpenAI-compatible endpoint twice with different
 * models to PROVE the swap mechanism. Claude/Qwen factories are shown but only
 * invoked if their API keys exist in the environment.
 */
import "dotenv/config";
import { Agent } from "./core/agent.js";
import { OpenAIProvider } from "./providers/openai.js";
import { createClaudeProvider, createQwenProvider } from "./providers/compatible.js";
import { TOOLS } from "./tools/index.js";
import { SYSTEM_PROMPT } from "./core/prompt.js";
import type { LLMProvider } from "./core/types.js";

async function runWith(provider: LLMProvider, label: string) {
  const agent = new Agent({ provider, tools: TOOLS, systemPrompt: SYSTEM_PROMPT });
  const res = await agent.run("What does a 401 error mean and how do I fix it?");
  console.log(`\n[${label} :: ${provider.name}] ${res.reply.slice(0, 220)}...`);
}

async function main() {
  // Same Agent code, two different model configs through one adapter.
  await runWith(new OpenAIProvider({ model: "gpt-5-mini" }), "Provider A (mini)");
  await runWith(new OpenAIProvider({ model: "gpt-5-nano" }), "Provider B (nano)");

  // Claude / Qwen: only attempt if keys are present (kept off by default).
  if (process.env.ANTHROPIC_API_KEY) {
    await runWith(createClaudeProvider(), "Claude");
  } else {
    console.log("\n[Claude] skipped (no ANTHROPIC_API_KEY) — factory exists; swap is one line.");
  }
  if (process.env.DASHSCOPE_API_KEY) {
    await runWith(createQwenProvider(), "Qwen");
  } else {
    console.log("[Qwen] skipped (no DASHSCOPE_API_KEY) — factory exists; swap is one line.");
  }

  console.log("\nNote: the Agent loop and all tools were byte-for-byte identical across providers.");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
