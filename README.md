# Aria — A From-Scratch AI Business Agent (TypeScript)

A customer service / business agent for an LLM API platform, built from scratch
(no agent frameworks) to teach the underlying concepts. It spans the full funnel:
**discovery → conversion → support**, mirroring the Sierra / Meta Business Agent pattern.

## Why from scratch?

Frameworks (LangGraph, Vercel AI SDK) hide the agent loop, the tool-calling
mechanism, and the eval harness — exactly the concepts worth learning. This repo
builds each by hand, then notes what the framework equivalent is called.

## Architecture

```
src/
├── core/
│   ├── types.ts        # Provider-agnostic interface layer (Message, Tool, LLMProvider)
│   ├── agent.ts        # The recursive ReAct agent loop
│   └── prompt.ts       # System prompt: the 4 "good" pillars + funnel modes
├── providers/
│   ├── openai.ts       # OpenAI translation adapter
│   └── compatible.ts   # Claude + Qwen factories (OpenAI-compatible, 1-line swap)
├── tools/
│   ├── index.ts        # search_documentation, check_api_status (support)
│   └── business.ts     # recommend_plan (discovery), create_draft_subscription (conversion)
├── eval/
│   ├── dataset.json    # Golden test set (support + discovery + guardrail)
│   └── run.ts          # LLM-as-judge harness for all 5 metrics
└── data/
    ├── knowledge.json  # Mock API docs / error codes (the per-tenant knowledge base)
    └── plans.json      # Plan catalog for recommendations
```

## The agent loop (the whole engine)

The loop sends history to the LLM; if the LLM asks for tools, it runs them,
appends results, and loops; if the LLM returns text, the turn is done. That's it.
(= Vercel AI SDK `generateText({maxSteps})`; = a cyclic graph in LangGraph.)

## The five metrics ("good" as a number)

| Metric | What it checks |
|---|---|
| Accuracy | Factual correctness / no hallucination (LLM-as-judge) |
| Resolution | Did it call the right tool + resolve? |
| Comfort | Tone / empathy (LLM-as-judge, 0-5) |
| Appropriate Deferral | Does it escalate destructive/out-of-scope requests? |
| Conversion Guardrail | Does it refuse to write before the user chooses? |

## Run it

```bash
# install
npm install

# the agent in an interactive REPL
npx tsx src/cli.ts

# support smoke test (rate-limit, MCP status, destructive-defer)
npx tsx src/smoke.ts

# discovery -> conversion funnel demo
npx tsx src/smoke_funnel.ts

# multi-provider proof (same loop, different brains)
npx tsx src/smoke_providers.ts

# the evaluation harness (all 5 metrics)
npx tsx src/eval/run.ts
```

Environment: `OPENAI_API_KEY` and `OPENAI_API_BASE` are read from the environment.
For Claude/Qwen, set `ANTHROPIC_API_KEY` / `DASHSCOPE_API_KEY`.

## Roadmap: Support Agent → Business Agent

v1 stops at a *reversible* draft. Next: binding conversion with confirmation,
a real recommendation engine, per-customer multi-tenant tuning, and semantic
(embedding-based) retrieval. The engine already generalizes; only the surface grows.
