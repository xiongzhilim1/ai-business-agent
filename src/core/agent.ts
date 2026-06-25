/**
 * agent.ts — The from-scratch Agent Loop. This is the whole "engine".
 *
 * What frameworks hide, we show:
 *   - We keep an explicit conversation `history` array.
 *   - We ask the provider for a response.
 *   - If the model asked for tools, WE run them, append results, and LOOP.
 *   - If the model returned plain text, the turn is done.
 *
 * This is the ReAct (Reason + Act) pattern, by hand.
 * (Vercel AI SDK = generateText({maxSteps}); LangGraph = a cyclic graph.)
 */
import type { LLMProvider, Message, Tool } from "./types.js";

export interface AgentOptions {
  provider: LLMProvider;
  tools: Tool[];
  systemPrompt: string;
  /** Safety cap so a misbehaving model can't loop forever. */
  maxSteps?: number;
  /** Optional callback to observe each step (used by eval + the blog demos). */
  onStep?: (event: AgentStepEvent) => void;
}

export type AgentStepEvent =
  | { type: "llm_response"; message: Message }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string };

export interface AgentRunResult {
  reply: string;
  history: Message[];
  steps: number;
}

export class Agent {
  private provider: LLMProvider;
  private tools: Tool[];
  private toolMap: Map<string, Tool>;
  private systemPrompt: string;
  private maxSteps: number;
  private onStep?: (event: AgentStepEvent) => void;

  constructor(opts: AgentOptions) {
    this.provider = opts.provider;
    this.tools = opts.tools;
    this.toolMap = new Map(opts.tools.map((t) => [t.name, t]));
    this.systemPrompt = opts.systemPrompt;
    this.maxSteps = opts.maxSteps ?? 6;
    this.onStep = opts.onStep;
  }

  /** Run one user turn to completion (text answer), executing tools as needed. */
  async run(userInput: string, prior: Message[] = []): Promise<AgentRunResult> {
    const history: Message[] = [
      { role: "system", content: this.systemPrompt },
      ...prior,
      { role: "user", content: userInput },
    ];

    let steps = 0;
    while (steps < this.maxSteps) {
      steps++;
      const { message } = await this.provider.generate({
        messages: history,
        tools: this.tools,
      });
      history.push(message);
      this.onStep?.({ type: "llm_response", message });

      // No tool calls => the model gave a final text answer. Done.
      if (!message.toolCalls || message.toolCalls.length === 0) {
        return { reply: message.content, history, steps };
      }

      // Otherwise: run each requested tool and feed results back in.
      for (const call of message.toolCalls) {
        this.onStep?.({ type: "tool_call", name: call.name, args: call.arguments });
        const tool = this.toolMap.get(call.name);
        const result = tool
          ? await tool.execute(call.arguments)
          : `ERROR: unknown tool '${call.name}'`;
        this.onStep?.({ type: "tool_result", name: call.name, result });
        history.push({
          role: "tool",
          content: result,
          toolCallId: call.id,
        });
      }
      // loop again so the model can read the tool results
    }

    return {
      reply: "I'm having trouble completing that. Let me hand you to a human teammate.",
      history,
      steps,
    };
  }
}
