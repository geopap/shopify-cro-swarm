# Shopify CRO hypotheses (Claude Code skill)

**Find where a Shopify store's funnel leaks, write ranked test ideas, and plan each A/B test properly, from one aggregate export. Offline, no API keys.**

You give it sessions, product views, add to cart, checkout and purchases per device or channel. It tells you:

- **where the orders are lost:** each step of each segment compared with your best segment, in lost orders and revenue, with a significance check;
- **what to test:** 3–5 hypotheses grounded in those numbers, scored PIE, with guardrails;
- **how to test it:** visitors per variant, duration in full weeks, a pre-registered decision rule, and a plain warning when a test is not feasible on your traffic.

## Install

Copy this folder into your skills directory:

```bash
cp -r shopify-cro-hypotheses ~/.claude/skills/
```

Then ask Claude Code, for example: *"Here is my funnel export by device. Where does it leak and what should I test first?"*

Requires Node.js 18 or later for the bundled calculator (`scripts/cro.mjs`, no dependencies).

## Try it on the sample

```bash
node scripts/cro.mjs funnel examples/sample-funnel.csv
node scripts/cro.mjs plan --baseline 0.108 --mde 0.10 --daily 1600
```

In the sample, mobile loses about 650 orders a period between product view and add to cart compared with desktop. The planner shows that detecting a +10% lift on that step needs about 13,500 visitors per variant, or three weeks.

## What it will not do

- It does not send your data anywhere or call any API.
- It does not use personal customer data; aggregate counts only.
- It does not propose fake scarcity, fake reviews, hidden costs or price changes.
- It treats a gap to your best segment as an upper bound, not a promise.

## The full version

This skill is one part of [Shopify CRO Agent Swarm](https://github.com/geopap/shopify-cro-swarm): agents that collect GA4 and Shopify data daily, generate hypotheses, open theme changes as pull requests after a person approves them, and verify the result statistically.

Built by [George Papadongonas](https://georgepapadongonas.com) · MIT licence
