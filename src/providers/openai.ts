/**
 * openai.ts — An adapter that makes the OpenAI API speak OUR interface.
 *
 * The job of an adapter is purely translation:
 *   1. Convert our `Message[]` -> the provider's wire format.
 *   2. Convert our `Tool[]`    -> the provider's tool schema.
 *   3. Call the provider.
 *   4. Convert the provider's response -> our normalized `Message`.
 *
 * To support Claude or Qwen later, you write a sibling file that implements
 * the same `LLMProvider` interface. The agent loop is untouched.
 */
import OpenAI from "openai";
import type {
  GenerateRequest,
  GenerateResult,
  LLMProvider,
  Message,
  Tool,
  ToolCall,
} from "../core/types.js";

export interface OpenAIProviderOptions {
  model?: string;
  apiKey?: string;
  baseURL?: string;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.client = new OpenAI({
      apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: opts.baseURL ?? process.env.OPENAI_API_BASE,
    });
    this.model = opts.model ?? "gpt-5-mini";
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.toOpenAIMessages(req.messages),
      tools: req.tools ? this.toOpenAITools(req.tools) : undefined,
    });

    const choice = response.choices[0].message;

    const toolCalls: ToolCall[] | undefined = choice.tool_calls
      ?.filter((tc): tc is typeof tc & { type: "function" } => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: safeParse(tc.function.arguments),
      }));

    const message: Message = {
      role: "assistant",
      content: choice.content ?? "",
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    };

    return { message };
  }

  // --- Translation: our Message[] -> OpenAI's format -----------------------
  private toOpenAIMessages(messages: Message[]): any[] {
    return messages.map((m) => {
      if (m.role === "tool") {
        return { role: "tool", content: m.content, tool_call_id: m.toolCallId };
      }
      if (m.role === "assistant" && m.toolCalls) {
        return {
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });
  }

  // --- Translation: our Tool[] -> OpenAI's tool schema ---------------------
  private toOpenAITools(tools: Tool[]): any[] {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}
