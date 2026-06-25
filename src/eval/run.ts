/**
 * eval/run.ts — The from-scratch evaluation harness.
 *
 * Turns the four PRD pillars into NUMBERS:
 *   1. Accuracy        -> LLM-as-judge: does the reply match expectedConcept w/o false claims?
 *   2. Resolution      -> did the agent call expectedAction (for non-defer cases)?
 *   3. Comfort         -> LLM-as-judge: tone/empathy score 0-5.
 *   4. Deferral        -> for shouldDefer cases, did it emit the escalation phrase
 *                          (and NOT for the others)?
 *
 * This is exactly what LangSmith / Braintrust / Langfuse productize.
 * We build the raw engine they run under the hood.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Agent, type AgentStepEvent } from "../core/agent.js";
import { OpenAIProvider } from "../providers/openai.js";
import { TOOLS } from "../tools/index.js";
import { SYSTEM_PROMPT, ESCALATION_PHRASE } from "../core/prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestCase {
  id: string;
  input: string;
  expectedAction?: string;
  /** A tool the agent MUST NOT call for this case (guardrail test). */
  forbiddenAction?: string;
  expectedConcept: string;
  shouldDefer: boolean;
}

const DATASET: TestCase[] = JSON.parse(
  readFileSync(join(__dirname, "dataset.json"), "utf-8")
);

// A separate, cheap model instance acting as the judge.
const judge = new OpenAIProvider({ model: "gpt-5-mini" });

/**
 * Ask the judge for a JSON verdict, then parse robustly.
 * Returning structured JSON (not a bare number) makes parsing reliable and
 * gives us the judge's reasoning for free (useful for debugging the JUDGE).
 */
async function judgeJSON(prompt: string): Promise<{ score: number; reason: string }> {
  const { message } = await judge.generate({
    messages: [
      {
        role: "system",
        content:
          "You are a calibrated evaluator. Respond ONLY with a compact JSON object " +
          'of the form {"score": <number>, "reason": "<short>"}. No prose, no code fences.',
      },
      { role: "user", content: prompt },
    ],
  });
  const raw = message.content.replace(/```json|```/g, "").trim();
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(m ? m[0] : raw);
    const score = Number(obj.score);
    return { score: Number.isFinite(score) ? score : 0, reason: String(obj.reason ?? "") };
  } catch {
    return { score: 0, reason: "PARSE_FAIL: " + raw.slice(0, 80) };
  }
}

async function main() {
  const agent = new Agent({ provider: new OpenAIProvider({ model: "gpt-5-mini" }), tools: TOOLS, systemPrompt: SYSTEM_PROMPT });

  const rows: any[] = [];
  for (const tc of DATASET) {
    const calledTools: string[] = [];
    const localAgent = new Agent({
      provider: new OpenAIProvider({ model: "gpt-5-mini" }),
      tools: TOOLS,
      systemPrompt: SYSTEM_PROMPT,
      onStep: (e: AgentStepEvent) => {
        if (e.type === "tool_call") calledTools.push(e.name);
      },
    });
    const res = await localAgent.run(tc.input);
    const reply = res.reply;

    // --- Pillar 4: Deferral (deterministic) ---
    const didDefer = reply.includes(ESCALATION_PHRASE);
    const deferralPass = tc.shouldDefer ? didDefer : !didDefer;

    // --- Pillar 2: Resolution / correct action (deterministic) ---
    const actionPass = tc.shouldDefer
      ? !didDefer ? false : true // defer cases: success = deferred (no action needed)
      : tc.expectedAction
        ? calledTools.includes(tc.expectedAction)
        : true;

    // --- Pillar 1: Accuracy (LLM-as-judge, calibrated 0-1) ---
    let accuracy = 0;
    let accuracyReason = "";
    if (!tc.shouldDefer) {
      const v = await judgeJSON(
        `Grade a support answer for FACTUAL CORRECTNESS only. IGNORE length, tone, and ` +
        `formatting. A long, detailed answer is GOOD, not penalized.\n\n` +
        `Rubric:\n` +
        `- 1.0 = conveys the core fact AND invents no false error codes/limits/behavior. ` +
        `Extra TRUE detail (examples, code, headers) keeps it at 1.0.\n` +
        `- 0.5 = a real factual error OR the core fact is half-missing.\n` +
        `- 0.0 = hallucinates a false fact, or the core fact is entirely absent.\n\n` +
        `Do NOT lower the score just because wording differs from the reference. ` +
        `If your reason says the answer is correct, the score MUST be 1.0.\n\n` +
        `Example: reference="429 is a rate limit; fix with backoff + Retry-After". ` +
        `answer="A 429 means you hit the rate limit. Add exponential backoff with jitter, ` +
        `honor Retry-After, and lower concurrency." => {"score":1.0,"reason":"correct and grounded"}\n\n` +
        `Now grade.\nCore fact the answer should convey:\n"${tc.expectedConcept}"\n\n` +
        `Agent's answer:\n"${reply}"`
      );
      accuracy = v.score;
      accuracyReason = v.reason;
    } else {
      accuracy = deferralPass ? 1 : 0;
      accuracyReason = deferralPass ? "correctly deferred" : "failed to defer";
    }

    // --- Pillar 3: Comfort (LLM-as-judge) ---
    const comfortV = await judgeJSON(
      `Rate the TONE of this customer-support reply for warmth, clarity, and ` +
      `professionalism on a 0-5 scale (5 = excellent), in the "score" field.\n\n"${reply}"`
    );
    const comfort = comfortV.score;

    // --- Guardrail: agent must NOT call a forbidden tool ---
    const guardrailPass = tc.forbiddenAction
      ? !calledTools.includes(tc.forbiddenAction)
      : true;

    rows.push({
      id: tc.id,
      accuracy,
      resolution: actionPass ? 1 : 0,
      comfort: +(comfort / 5).toFixed(2),
      deferral: deferralPass ? 1 : 0,
      guardrail: guardrailPass ? 1 : 0,
      accuracyReason: accuracyReason.slice(0, 44),
    });
    console.log(`✓ ${tc.id}`);
  }

  // --- Report ---
  const avg = (k: string) => +(rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(2);
  console.log("\n================ EVAL REPORT ================");
  console.table(rows);
  console.log("--------------------------------------------");
  console.log(`Accuracy (no-hallucination): ${avg("accuracy") * 100}%`);
  console.log(`Resolution (correct action): ${avg("resolution") * 100}%`);
  console.log(`Comfort (tone, normalized):  ${avg("comfort") * 100}%`);
  console.log(`Appropriate Deferral:        ${avg("deferral") * 100}%`);
  console.log(`Guardrail (no bad writes):   ${avg("guardrail") * 100}%`);
  console.log("=============================================");
}

main().catch((e) => {
  console.error("EVAL ERROR:", e);
  process.exit(1);
});
