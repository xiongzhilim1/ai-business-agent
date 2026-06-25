/**
 * types.ts — The provider-agnostic vocabulary of our agent.
 *
 * Nothing in here mentions OpenAI, Claude, or Qwen. These are OUR types.
 * Each provider adapter is responsible for translating to/from these shapes.
 * This is the "lightweight interface layer" that keeps the agent loop
 * decoupled from any single LLM vendor.
 */

/** A single turn in the conversation, normalized across all providers. */
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Present when the assistant decides to call one or more tools. */
  toolCalls?: ToolCall[];
  /** Present on a `tool` message: which call this result answers. */
  toolCallId?: string;
}

/** A request from the model to run one of our tools. */
export interface ToolCall {
  id: string;
  name: string;
  /** Raw arguments object already parsed from the model's JSON string. */
  arguments: Record<string, unknown>;
}

/** A JSON-Schema-ish description of a tool's input. Provider-neutral. */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

/** A tool the agent can use: a name, a description, a schema, and a fn. */
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  /** The actual local implementation. Returns a string the model reads. */
  execute: (args: Record<string, unknown>) => Promise<string> | string;
}

/** What we ask a provider to do on each loop iteration. */
export interface GenerateRequest {
  messages: Message[];
  tools?: Tool[];
  /** Optional knobs; providers map these as best they can. */
  temperature?: number;
}

/** The normalized result coming back from any provider. */
export interface GenerateResult {
  message: Message; // assistant message (may contain toolCalls)
}

/**
 * The single seam every LLM plugs into. Implement this once per vendor
 * (OpenAI, Claude, Qwen, a local model) and the agent loop never changes.
 */
export interface LLMProvider {
  readonly name: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}
