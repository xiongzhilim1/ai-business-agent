# Building a Business Agent from Scratch: Why a Sales Agent is Not a Support Agent

*Part 3 of the "Deconstructing the AI Business Agent" Series*

When we started building our AI agent, the goal was simple: build a support bot for developers using an API platform. It would read documentation, diagnose errors, and check system status.

But halfway through, we realized we were building the wrong thing.

Companies like Meta are not pitching "support bots." They are pitching **Business Agents**—AI that spans the entire customer funnel, from discovery to conversion to post-sale support.

We decided to stretch our v1 agent to cover this full funnel. What we learned is that a sales agent is not just a support agent with extra tools. It requires a completely different mindset around goals, metrics, and risk.

## The Three Modes of a Business Agent

To span the funnel, our agent needed to handle three distinct modes of interaction, all within the same conversation:

1.  **Support:** The user has a problem (e.g., "Why am I getting a 429 error?"). The agent's job is to *diagnose and resolve*.
2.  **Discovery:** The user is exploring options (e.g., "Which plan is best for a high-volume classification task?"). The agent's job is to *ground options and recommend*.
3.  **Conversion:** The user has made a choice (e.g., "Let's go with the Nano plan."). The agent's job is to *capture intent and act*.

Because we built our Agent Loop from scratch (see Part 2), adding these modes was architecturally trivial. We didn't have to rewrite the engine. We just gave the agent two new tools: `recommend_plan` (a read-only catalog lookup) and `create_draft_subscription` (a write-action to capture intent).

The hard part was the prompt engineering and the guardrails.

## The Risk Profile of Conversion

Support agents are relatively safe. They read data and give advice. If they mess up, the user is annoyed, but nothing is broken.

Conversion agents are dangerous. They take *write actions*. They modify databases, create orders, and move money.

To make our conversion flow safe, we implemented the **Reversible Write Pattern**.

When a user says "Let's go with the Nano plan," the agent does not charge their credit card. Instead, it calls `create_draft_subscription`. This tool creates a non-binding *draft* in the database and returns a draft ID. The agent then replies:

> "Done — I created a DRAFT subscription for the Nano plan. This is reversible and non-binding; no charge has been made. Confirm the draft when you're ready to activate."

The agent acts, but humans remain in control of anything irreversible.

## The Conversion Guardrail

You cannot trust an LLM to be perfectly safe just because you asked it nicely in the system prompt. You have to measure it.

A critical failure mode for a Business Agent is being too aggressive—trying to close a sale or create an order before the user has actually made a choice.

To prevent this, we added a strict **Conversion Guardrail** to our evaluation harness. We added test cases where the user asks vague discovery questions like, "What plans do you offer for a chatbot?"

Our harness verifies that during these turns, the agent *never* calls the `create_draft_subscription` tool. If the agent tries to create a draft before the user explicitly says "I want this one," the test fails.

## The Engine Generalizes; The Surface Area Grows

The most profound lesson of building this Business Agent is that the core AI engine—the recursive loop of reasoning, tool-calling, and observing—is incredibly general.

The exact same loop that diagnosed a rate-limit error was able to compare pricing tiers, recommend a product, and create a draft order. The difference between a support bot and a business agent isn't the AI architecture; it's the tools you provide, the guardrails you enforce, and the metrics you use to define "good."
