# Shopify CRO Agent Swarm

Autonomous CRO (Conversion Rate Optimization) agent swarm for any Shopify store. The system collects performance data daily, analyzes funnel leaks against baselines, generates ranked hypotheses, implements approved changes as Shopify theme PRs, and verifies results after 7 days.

## Architecture

- **Runtime:** Node 22, TypeScript strict, ESM modules
- **Scheduling:** GitHub Actions cron workflows
- **Data store:** Validated JSON files in `data/` (Zod schemas in `src/types/schemas.ts`)
- **Theme repo:** Separate Shopify theme repo — PRs opened by Implementer agent
- **Notifications:** Slack incoming webhook

## Daily Loop

```
05:00 UTC  [data-collector]  → data/snapshots/YYYY-MM-DD.json
06:00 UTC  [conductor]       → triggers analyst → hypothesis → ad-watchdog → digest
           [analyst]         → data/analyses/YYYY-MM-DD.json
           [hypothesis]      → data/hypotheses/YYYY-MM-DD.json
           [ad-watchdog]     → Slack alert if ROAS below threshold
           [conductor]       → Slack daily digest
Manual     [implementer]     → PR on theme repo (requires human approval)
7d later   [verifier]        → data/verifications/EXP-XXX.json
Monday     [seo-content]     → keyword opportunities, meta tag PRs, blog drafts
```

## Agent Roster

| Agent | Model | Writes Code? |
|-------|-------|-------------|
| conductor | sonnet | No |
| data-collector | sonnet | No (runs scripts) |
| analyst | sonnet | No |
| hypothesis | sonnet | No |
| implementer | opus | Yes (Liquid/CSS/JS) |
| verifier | sonnet | No |
| seo-content | sonnet | Yes (content/meta) |
| ad-watchdog | sonnet | No |

## Safety Rails — NON-NEGOTIABLE

1. **Never** merge PRs automatically — human approval required
2. **Never** modify checkout code without explicit approval
3. **Never** change pricing (product prices, shipping rates, discount logic)
4. **Never** delete products, collections, or pages
5. **Never** modify customer data or order data
6. Implementer ONLY runs when a hypothesis has `status: "approved"`
7. All theme changes go through PR review on the theme repo

## Data Conventions

- All JSON validated by Zod schemas in `src/types/schemas.ts`
- Date format: `YYYY-MM-DD` (ISO 8601)
- Timestamps: ISO 8601 with timezone (`2026-03-23T06:00:00Z`)
- Currency: no currency symbols in JSON — just numbers (configure your store's currency in agent prompts)
- Percentages: decimal form in JSON (0.042 = 4.2%), display as percentage in digests

## File Conventions

- Scripts in `scripts/` — executable entry points (run via `tsx`)
- Shared library code in `src/lib/`
- Types and schemas in `src/types/`
- Agent prompts in `agents/<name>/SKILL.md`
- Tests in `src/__tests__/`
- All imports use `.js` extension (ESM)
