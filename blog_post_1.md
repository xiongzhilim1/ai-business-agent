# Building a Business Agent from Scratch: Why "Good" is a Number, Not a Vibe

*Part 1 of the "Deconstructing the AI Business Agent" Series*

When most teams set out to build an AI customer service agent, they start by picking a framework—LangGraph, Vercel AI SDK, or LlamaIndex. They write a prompt, plug in some tools, and ask it a few questions. If the answers feel right, they ship it.

This is exactly how you build a bad agent.

In this series, we are building a full-funnel Business Agent (spanning discovery, conversion, and support) from scratch in TypeScript. We aren't using any frameworks, because frameworks hide the mechanics you need to understand to build something reliable. But before we wrote a single line of code, we had to answer a much harder question: **What does "good" actually mean, and how do we measure it?**

If you cannot define "good" as a number, you cannot build a good agent. Here is the framework we used to define and measure our agent.

## The Four Pillars of a Support Agent

A great customer service agent's first job is to not confidently make things worse. We defined "good" through four measurable pillars, and built an evaluation harness to track them on every commit:

**1. Factual Correctness (No Hallucination)**
The agent must provide accurate information based strictly on its knowledge base. We measure this using an LLM-as-a-judge against a "golden" test set of Question → Correct-Answer pairs.

**2. Meaningful Resolution (Containment)**
A polite answer is useless if it doesn't solve the problem. The agent must successfully call the right tool (e.g., looking up a transaction status) and provide a final answer. We measure this by verifying the agent executed the `expectedAction` for a given test case.

**3. Comfort & Empathy**
The agent must communicate clearly, professionally, and empathetically. We measure this by having our LLM-judge score the agent's tone on a strict 0-5 rubric.

**4. Appropriate Deferral**
This is the pillar everyone skips. An agent must know when a problem is out-of-scope, destructive (e.g., "delete my account"), or unsolvable, and escalate it. We measure this by feeding the agent toxic or out-of-scope queries and verifying it emits a hardcoded escalation phrase instead of guessing.

## From Support to Sales: The Conversion Guardrail

Halfway through our build, we realized a "support bot" is not a "business agent." A business agent, like the ones Meta builds, spans the entire funnel:
*   **Discovery:** "Which product is right for me?"
*   **Conversion:** "Add this to my cart."
*   **Support:** "Why is this broken?"

We added discovery and conversion tools to our agent. But a conversion agent needs a different risk profile than a support agent. It has to take *write actions* (like creating an order).

To make this safe, we introduced the **Reversible Write Pattern**. Our conversion tool (`create_draft_subscription`) creates a *draft* only. It never bills, never commits, and returns a draft ID the user can confirm or discard.

To measure this, we added a fifth metric to our harness:
**5. The Conversion Guardrail**
The agent must never take a write-action before the user explicitly chooses an option. We test this by asking vague discovery questions ("What plans do you offer?") and ensuring the `create_draft_subscription` tool is strictly forbidden during that turn.

## Your Judge is Probably Broken

When we first ran our evaluation harness, our agent scored 100% on Resolution and Deferral, but only 67% on Accuracy.

When we looked at the traces, the agent's answers were perfectly correct. The bug was in our *evaluator*. We had asked the LLM-judge to return a binary 0 or 1. When the agent gave a rich, detailed, 300-word answer, the judge punished it for not perfectly matching the terse 15-word reference string in our dataset.

This is the most important lesson of agent evals: **Your evaluation harness is itself a system that can be wrong.** If you blindly trust the top-line number, you will start "fixing" a perfectly good agent and make it worse. You must evaluate your evaluator.

In Part 2, we will look at the code. We will build the recursive ReAct loop from scratch, bypassing the frameworks to show you exactly how an LLM decides to pause, use a tool, and resume.
