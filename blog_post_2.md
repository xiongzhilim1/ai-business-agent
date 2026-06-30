# Building a Business Agent from Scratch: Exposing the Loop

*Part 2 of the "Deconstructing the AI Business Agent" Series*

If you use LangGraph, you build a cyclic graph with conditional edges. If you use the Vercel AI SDK, you call `generateText({ maxSteps: 5 })`. These abstractions are powerful, but they hide the most important mechanic in AI engineering: the Agent Loop.

To truly understand how an agent reasons and acts, you need to build the loop by hand. In this post, we'll walk through the from-scratch TypeScript architecture of our Business Agent.

## The ReAct Pattern, Unmasked

The heart of our system is the Agent Loop. It is a simple state machine that orchestrates the conversation between the user, the LLM, and the available tools. This is the ReAct (Reasoning and Acting) pattern stripped down to its studs.

Here is the entire engine:

1.  **Receive Input:** The user sends a message. We append it to a `history` array.
2.  **LLM Inference:** We send the `history` (plus our system prompt and tool JSON schemas) to the LLM.
3.  **Evaluate Response:**
    *   If the LLM returns plain text, it means it has formulated a final answer. We append it to history and return it to the user. The turn is over.
    *   If the LLM returns a `tool_calls` request, it is asking for data. We append the tool call request to history, execute the local TypeScript function, append the result as a `tool` message, and **loop back to step 2**.

```typescript
// The core loop (simplified)
while (steps < maxSteps) {
  const { message } = await provider.generate({ messages: history, tools });
  history.push(message);

  if (!message.toolCalls) {
    return message.content; // Done!
  }

  for (const call of message.toolCalls) {
    const result = await executeTool(call.name, call.arguments);
    history.push({ role: "tool", content: result, toolCallId: call.id });
  }
}
```

When you build it this way, the magic disappears. You see exactly how the LLM decides to pause, ask for data, and resume. You also see why agents can be slow: a single user turn might require three sequential network calls to the LLM API if it needs to use multiple tools.

## The Interface Layer: Surviving Vendor Lock-in

The AI landscape changes weekly. If you hardcode your agent to the OpenAI SDK's specific message formats and tool schemas, you will have to rewrite your entire application when you want to switch to Anthropic's Claude or Alibaba's Qwen.

To prevent this, we built a **Provider-Agnostic Interface Layer**.

We defined our *own* types for `Message`, `Tool`, and `LLMProvider`. The Agent Loop only speaks our types. It has no idea what an OpenAI or Anthropic is.

```typescript
export interface LLMProvider {
  readonly name: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}
```

Each vendor gets a thin adapter class whose only job is translation:
1.  Convert our `Message[]` into the vendor's wire format.
2.  Convert our `Tool[]` into the vendor's tool schema.
3.  Call the vendor API.
4.  Convert the vendor's response back into our normalized `Message`.

### The Payoff: One-Line Swaps

Because Claude and Qwen both offer OpenAI-compatible API endpoints, supporting them didn't even require new translation logic. We simply pointed the OpenAI adapter at a different `baseURL` and passed a different API key.

```typescript
// Swapping the brain is a one-line change
const agent = new Agent({
  provider: new OpenAIProvider({ model: "gpt-5-mini" }), // Or Claude, or Qwen
  tools: [searchDocumentation, recommendPlan, createDraftSubscription],
  systemPrompt: SYSTEM_PROMPT
});
```

During testing, we ran the exact same Agent loop, with the exact same tools, against two different models. The loop was byte-for-byte identical.

By defining "good" with numbers (Part 1) and decoupling our logic from our LLM vendor (Part 2), we built a foundation that can survive the rapid shifts in AI capability. In the final part of this series, we will look at how we turned this support bot into a true Business Agent capable of driving conversions.
