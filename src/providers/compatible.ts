/**
 * compatible.ts — Proof that the interface layer is real.
 *
 * Claude (Anthropic) and Qwen (Alibaba/DashScope) BOTH ship OpenAI-compatible
 * endpoints. So supporting them is just: point the same adapter at a different
 * baseURL + model + apiKey. The agent loop and tools are 100% unchanged.
 *
 * For providers with NON-compatible wire formats (e.g. native Anthropic
 * Messages API), you'd instead write a sibling adapter implementing the same
 * `LLMProvider` interface and translate inside it — see the commented sketch.
 */
import { OpenAIProvider } from "./openai.js";
import type { LLMProvider } from "../core/types.js";

/**
 * Claude via an OpenAI-compatible gateway.
 * Real usage:
 *   new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY })
 * pointed at an OpenAI-compatible proxy, or Anthropic's compat endpoint.
 */
export function createClaudeProvider(opts: { apiKey?: string; baseURL?: string; model?: string } = {}): LLMProvider {
  return new OpenAIProvider({
    apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY,
    baseURL: opts.baseURL ?? "https://api.anthropic.com/v1/", // OpenAI-compatible path
    model: opts.model ?? "claude-3-5-sonnet",
  });
}

/**
 * Qwen via DashScope's OpenAI-compatible mode.
 * baseURL: https://dashscope.aliyuncs.com/compatible-mode/v1
 */
export function createQwenProvider(opts: { apiKey?: string; baseURL?: string; model?: string } = {}): LLMProvider {
  return new OpenAIProvider({
    apiKey: opts.apiKey ?? process.env.DASHSCOPE_API_KEY,
    baseURL: opts.baseURL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: opts.model ?? "qwen-plus",
  });
}

/**
 * --- Sketch: a NON-compatible provider (native Anthropic Messages API) ---
 *
 * If a vendor is NOT OpenAI-compatible, you implement LLMProvider directly:
 *
 * export class NativeAnthropicProvider implements LLMProvider {
 *   readonly name = "anthropic-native";
 *   async generate(req: GenerateRequest): Promise<GenerateResult> {
 *     // 1. map our Message[] -> Anthropic's {role, content[]} + system param
 *     // 2. map our Tool[]    -> Anthropic's input_schema tool format
 *     // 3. call client.messages.create(...)
 *     // 4. map content blocks (text + tool_use) -> our Message{content,toolCalls}
 *   }
 * }
 *
 * The agent loop never sees any of this. That's the seam doing its job.
 */
