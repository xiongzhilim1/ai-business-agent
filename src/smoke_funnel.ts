import "dotenv/config";
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
      if (e.type === "tool_call") console.log(`  [tool_call] ${e.name}(${JSON.stringify(e.args)})`);
      if (e.type === "tool_result") console.log(`  [tool_result] ${e.result.slice(0, 110)}`);
    },
  });

  // A multi-turn DISCOVERY -> CONVERSION conversation.
  let history: Message[] = [];

  const turn = async (text: string) => {
    console.log(`\n=== USER: ${text}`);
    const res = await agent.run(text, history);
    history = res.history.filter((m) => m.role !== "system");
    console.log(`--- ARIA: ${res.reply}`);
  };

  await turn("I'm building a high-volume classification pipeline, millions of short calls a day. Which plan should I use?");
  await turn("That sounds right. Let's go with Nano. Can you set it up?");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
