# Product Requirements Document (PRD): v1 AI Customer Service Agent

**Author:** Manus AI (with user)
**Date:** June 22, 2026
**Status:** Draft

## 1. Executive Summary

We are building a v1 AI Customer Service Agent designed to support developers using an LLM/AI API platform. The goal is to build an agent that behaves like Sierra or Meta Business Agent, capable of diagnosing complex, multi-step problems and taking observable actions, rather than just acting as a static FAQ bot. 

This build serves a dual purpose: 
1. **Product:** Create a functional, testable support agent for a highly relevant domain.
2. **Education:** Serve as the foundation for a blog series that teaches the concepts of agent-building from scratch in TypeScript, demystifying the abstractions hidden by popular frameworks.

## 2. Target Audience & Domain

### 2.1 The Domain: LLM/AI API Support
The agent's "world" is developer support for an AI API platform (e.g., chat completions, tokens, rate limits, model parameters, function-calling, MCP/harness integration).

### 2.2 The User
The end-user is a developer integrating AI APIs who is stuck on a complex issue (e.g., "Why am I getting a 429?", "What is the difference between these models?", "Why did my function call fail?"). We chose this domain because *we* are the users, allowing for immediate, high-fidelity dogfooding and real-world testing.

## 3. Product Principles: What is a "Good" Agent?

A great customer service agent's first job is to not confidently make things worse. We define "good" through four measurable pillars:

| Principle | Definition | How We Measure (v1 & Beyond) |
| :--- | :--- | :--- |
| **Factual Correctness (No Hallucination)** | The agent must provide accurate information based strictly on its knowledge base. | LLM-as-judge against a golden test set of Question → Correct-Answer pairs. |
| **Meaningful Resolution (Containment)** | The agent must solve the user's problem without human handoff. | Percentage of conversations solved (resolution rate) on a labeled evaluation set. |
| **Comfort & Empathy** | The agent must communicate clearly, professionally, and empathetically. | Judge-scored on a tone/empathy rubric; optionally user CSAT (thumbs up/down). |
| **Appropriate Deferral** | The agent must know when a problem is out-of-scope, risky, or unsolvable, and escalate it. | Percentage of out-of-scope or risky queries correctly deferred to a human. |
| **Conversion Guardrail** | The agent must never take a write-action (create a draft) before the user explicitly chooses. | Dedicated eval case verifying the forbidden tool is NOT called. |

## 4. Scope & Capabilities

### 4.1 v1 Scope (The MVP)
The v1 agent will handle **multi-step diagnostic problems with knowable answers.** It will reason through likely causes, ask clarifying questions, and produce a specific fix.

**Core Capabilities:**
1. **Conversational Interface:** Accept natural language queries from developers.
2. **Knowledge Retrieval:** Query a simulated knowledge base of API documentation, error codes, and integration guides (including complex topics like MCP/harness integration) via a `search_documentation` tool.
3. **Read-Only Status Action:** A `check_api_status` tool proves the agent can *do* something, not just *say* something (the observable action from the original scope).

**Business-Agent Capabilities (Path B extension — full funnel, tightly scoped to the AI API domain):**
Following the Meta Business Agent pattern, v1 now spans the whole funnel, not just post-sale support:
4. **Discovery / Recommendation (`recommend_plan`, read-only):** When a developer is unsure which model/plan fits their use-case and volume, the agent grounds itself in a plan catalog and recommends a best-fit tier (Nano / Mini / Flagship) with reasoning. This is the "advance the user toward a choice" behavior.
5. **Conversion (`create_draft_subscription`, REVERSIBLE write):** Once the developer explicitly chooses a plan, the agent captures intent by creating a non-binding, no-charge DRAFT subscription that the user can confirm or discard. This is the one safe write-action, demonstrating the discovery → conversion mechanic end-to-end.

**Conversion Guardrail (added metric):** The agent MUST NOT create a draft subscription before the user has explicitly chosen a plan. This is enforced in the system prompt and verified by a dedicated eval case (t8).

### 4.2 Out of Scope for v1 (Roadmap / v2)
*   **Binding/irreversible write actions** (e.g., activating/charging a subscription, changing account settings, issuing refunds, modifying API keys). v1 stops at the reversible *draft*.
*   **Multi-tenant tuning platform:** a UI for customers to upload their own Q&A and connect their own endpoints (Meta offers this). v1 re-tunes by swapping the knowledge/plan JSON files.
*   **Semantic retrieval:** v1 uses deterministic keyword search; production would use embeddings/vector search.
*   **Multi-action chaining** (executing a long autonomous sequence of tools).
*   **Generalization to other verticals** (e.g., hospitality/hotels), parked as a second arbitrage lever.

### 4.3 Roadmap: From Support Agent to Business Agent
The key product insight (surfaced during planning) is that a sales/discovery agent is **not** a support agent with extra tools — it has different goals, metrics, and risk profile. The path forward: (1) binding conversion with confirmation guardrails, (2) a real recommendation engine, (3) per-customer multi-tenant tuning, (4) semantic retrieval. The core agent *engine* already generalizes to all of these; only the surface area grows.

## 5. Technical Approach & Build Philosophy

### 5.1 From-Scratch First
To fulfill the educational goal, we will build the v1 agent **from scratch** using raw LLM APIs, our own agent loop, tool-calling mechanism, and evaluation harness. We will *not* use frameworks like LangGraph or Vercel AI SDK initially.

Once built, we will explicitly map our from-scratch components to the framework equivalents (e.g., "Here is our custom tool router; here is what it looks like in LangChain") to teach the underlying concepts.

### 5.2 Stack
*   **Language:** TypeScript
*   **LLM Provider:** OpenAI API (via sandbox environment)
*   **Environment:** Node.js

## 6. Success Criteria for this Project

1.  A functional v1 TypeScript agent that can answer API support questions and successfully execute its one read-only tool.
2.  An evaluation harness that can measure the four "Good" metrics against a small test set.
3.  A complete Technical Design Document (TDD).
4.  Drafts for a blog series explaining the build process, the "Good" metrics, and the from-scratch vs. framework comparisons.
