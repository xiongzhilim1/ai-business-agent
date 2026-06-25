/**
 * tools/business.ts — The "business agent" tools that take us beyond support
 * into DISCOVERY and CONVERSION (the Meta Business Agent funnel).
 *
 * These are still just `Tool` objects on the SAME agent loop. The loop didn't
 * change at all — that's the whole point of the from-scratch architecture.
 *
 *   - recommend_plan          : DISCOVERY  (read-only) — advance user to a choice
 *   - create_draft_subscription : CONVERSION (REVERSIBLE write) — capture intent
 *
 * Design note on safety: the write action creates a DRAFT only. It never bills,
 * never commits, and returns a draft id the user can confirm or discard. This is
 * the "reversible write" pattern: let the agent ACT, but keep humans in control
 * of anything irreversible.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Tool } from "../core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Plan {
  id: string;
  name: string;
  model: string;
  pricePer1MInput: number;
  pricePer1MOutput: number;
  bestFor: string[];
  contextWindow: number;
  monthlyQuotaRpm: number;
  available: boolean;
}

const PLANS: Plan[] = JSON.parse(
  readFileSync(join(__dirname, "../data/plans.json"), "utf-8")
);

/** In-memory "database" of draft subscriptions. Reversible by design. */
const DRAFTS = new Map<string, { plan: string; createdAt: string; status: string }>();

/** DISCOVERY: read-only catalog lookup the agent uses to recommend a plan. */
export const recommendPlan: Tool = {
  name: "recommend_plan",
  description:
    "Look up the plan/model catalog with pricing, quotas, and what each plan is best for. " +
    "Use this during DISCOVERY when a developer is unsure which model/plan fits their use-case " +
    "or volume. Returns plan options so you can recommend the best fit (do not invent prices).",
  parameters: {
    type: "object",
    properties: {
      useCase: {
        type: "string",
        description: "What the developer wants to build, e.g. 'a coding agent' or 'high-volume classification'.",
      },
    },
    required: ["useCase"],
  },
  execute: (args) => {
    const useCase = String(args.useCase ?? "");
    // Return the full catalog as grounding; the LLM does the matching/reasoning.
    return JSON.stringify({
      useCaseEcho: useCase,
      plans: PLANS.filter((p) => p.available).map((p) => ({
        name: p.name,
        model: p.model,
        pricePer1MInput: p.pricePer1MInput,
        pricePer1MOutput: p.pricePer1MOutput,
        bestFor: p.bestFor,
        monthlyQuotaRpm: p.monthlyQuotaRpm,
      })),
    });
  },
};

/** CONVERSION: the one REVERSIBLE write-action. Creates a non-binding draft. */
export const createDraftSubscription: Tool = {
  name: "create_draft_subscription",
  description:
    "Create a DRAFT (non-binding, reversible, no charge) subscription to a plan once the " +
    "developer has agreed on which plan they want. Returns a draftId the developer can later " +
    "confirm or discard. NEVER use this without the developer explicitly choosing a plan first. " +
    "This does NOT charge anyone or activate anything.",
  parameters: {
    type: "object",
    properties: {
      planName: {
        type: "string",
        enum: ["Nano", "Mini", "Flagship"],
        description: "The plan the developer agreed to.",
      },
    },
    required: ["planName"],
  },
  execute: (args) => {
    const planName = String(args.planName ?? "");
    const plan = PLANS.find((p) => p.name.toLowerCase() === planName.toLowerCase());
    if (!plan) {
      return JSON.stringify({ error: `Unknown plan '${planName}'. Valid: Nano, Mini, Flagship.` });
    }
    const draftId = "draft_" + Math.random().toString(36).slice(2, 10);
    DRAFTS.set(draftId, { plan: plan.name, createdAt: new Date().toISOString(), status: "DRAFT" });
    return JSON.stringify({
      draftId,
      plan: plan.name,
      status: "DRAFT",
      binding: false,
      charged: false,
      note: "Draft created. The developer can confirm to activate or discard. No charge has occurred.",
    });
  },
};

export const BUSINESS_TOOLS: Tool[] = [recommendPlan, createDraftSubscription];
