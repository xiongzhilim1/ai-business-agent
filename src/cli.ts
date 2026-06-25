/**
 * cli.ts — A tiny REPL to talk to the agent and watch the loop work.
 * Run: npx tsx src/cli.ts
 */
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Agent } from "./core/agent.js";
import { OpenAIProvider } from "./providers/openai.js";
import { TOOLS } from "./tools/index.js";
import { SYSTEM_PROMPT } from "./core/prompt.js";
import type { Message } from "./core/types.js";

async function main() {
  const agent = new Agent({
    provider: new OpenAIProvider({ model: "gpt-5-mini" }),
    tools: TOOLS,
    systemPrompt: SYSTEM_PROMPT,
    onStep: (e) => {
      if (e.type === "tool_call") {
        console.log(`\x1b[90m  ↳ calling ${e.name}(${JSON.stringify(e.args)})\x1b[0m`);
      } else if (e.type === "tool_result") {
        console.log(`\x1b[90m  ↳ ${e.name} returned: ${e.result.slice(0, 120)}...\x1b[0m`);
      }
    },
  });

  const rl = readline.createInterface({ input, output });
  let history: Message[] = [];
  console.log("Aria (AI API Support) — type 'exit' to quit.\n");

  while (true) {
    const q = await rl.question("\x1b[36myou › \x1b[0m");
    if (q.trim().toLowerCase() === "exit") break;
    const res = await agent.run(q, history);
    console.log(`\x1b[32maria ›\x1b[0m ${res.reply}\n`);
    // keep only non-system turns for continuity
    history = res.history.filter((m) => m.role !== "system");
  }
  rl.close();
}

main();
