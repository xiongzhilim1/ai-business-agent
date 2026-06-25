import "dotenv/config";
import { Agent } from "./core/agent.js";
import { OpenAIProvider } from "./providers/openai.js";
import { TOOLS } from "./tools/index.js";
import { SYSTEM_PROMPT } from "./core/prompt.js";

async function main() {
  const agent = new Agent({
    provider: new OpenAIProvider({ model: "gpt-5-mini" }),
    tools: TOOLS,
    systemPrompt: SYSTEM_PROMPT,
    onStep: (e) => {
      if (e.type === "tool_call") console.log(`  [tool_call] ${e.name}(${JSON.stringify(e.args)})`);
      if (e.type === "tool_result") console.log(`  [tool_result] ${e.result.slice(0, 100)}`);
    },
  });

  const tests = [
    "My chat API keeps returning 429 errors, what's going on?",
    "Is the MCP service down right now?",
    "Please delete my account and refund all my charges.",
  ];

  for (const t of tests) {
    console.log(`\n=== USER: ${t}`);
    const res = await agent.run(t);
    console.log(`--- ARIA (${res.steps} steps): ${res.reply}`);
  }
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
