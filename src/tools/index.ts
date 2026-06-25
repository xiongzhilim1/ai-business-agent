/**
 * tools/index.ts — The agent's "hands".
 *
 * Each tool is a plain object: name + description + JSON schema + execute().
 * Note these are provider-agnostic (they use OUR `Tool` type), so the same
 * tool works whether the brain is OpenAI, Claude, or Qwen.
 *
 * v1 ships TWO tools:
 *   - search_documentation : grounds answers (anti-hallucination / RAG-lite)
 *   - check_api_status     : the one observable READ-ONLY action from the PRD
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Tool } from "../core/types.js";
import { BUSINESS_TOOLS } from "./business.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface KBEntry {
  id: string;
  keywords: string[];
  title: string;
  content: string;
}

const KB: KBEntry[] = JSON.parse(
  readFileSync(join(__dirname, "../data/knowledge.json"), "utf-8")
);

/** Deterministic keyword search over the local KB. Keeps v1 simple & debuggable. */
export const searchDocumentation: Tool = {
  name: "search_documentation",
  description:
    "Search the official API documentation and error-code reference. " +
    "ALWAYS use this before answering a factual question. Returns matching doc snippets.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Keywords describing the user's problem, e.g. '429 rate limit' or 'mcp setup'",
      },
    },
    required: ["query"],
  },
  execute: (args) => {
    const query = String(args.query ?? "").toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const scored = KB.map((entry) => {
      const haystack = (entry.keywords.join(" ") + " " + entry.title).toLowerCase();
      const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      return { entry, score };
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    if (scored.length === 0) {
      return "NO_RESULTS: No matching documentation found. Do not guess; consider deferring.";
    }
    return scored
      .map((s) => `### ${s.entry.title}\n${s.entry.content}`)
      .join("\n\n");
  },
};

/** The one observable, READ-ONLY action. Simulated platform status lookup. */
export const checkApiStatus: Tool = {
  name: "check_api_status",
  description:
    "Look up the current operational status and rate-limit tier for a given service/model. " +
    "Read-only. Use when a user reports something is down, slow, or being throttled.",
  parameters: {
    type: "object",
    properties: {
      service: {
        type: "string",
        enum: ["chat", "embeddings", "mcp"],
        description: "Which service to check.",
      },
      model: {
        type: "string",
        description: "Optional model name, e.g. 'mini' or 'flagship'.",
      },
    },
    required: ["service"],
  },
  execute: (args) => {
    const service = String(args.service ?? "chat");
    // Simulated backend response. In production this would hit a real status API.
    const mock: Record<string, object> = {
      chat: { status: "operational", rateLimit: "100 RPM / 200k TPM", incidents: "none" },
      embeddings: { status: "operational", rateLimit: "500 RPM", incidents: "none" },
      mcp: { status: "degraded", rateLimit: "50 RPM", incidents: "Elevated connection errors on MCP gateway (investigating)" },
    };
    const result = mock[service] ?? { status: "unknown", service };
    return JSON.stringify({ service, ...result });
  },
};

// Support tools + business (discovery/conversion) tools, all on the same loop.
export const TOOLS: Tool[] = [searchDocumentation, checkApiStatus, ...BUSINESS_TOOLS];
