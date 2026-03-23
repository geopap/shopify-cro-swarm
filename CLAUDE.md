# Shopify CRO Agent Swarm

Autonomous CRO (Conversion Rate Optimization) agent swarm for any Shopify store. 19 AI agents collect metrics, analyze funnel leaks, generate hypotheses, implement theme changes as PRs, verify results, monitor competitors, optimize email flows, manage inventory, and more — all on autopilot via GitHub Actions.

## Architecture

- **Runtime:** Node 22, TypeScript strict, ESM modules
- **Scheduling:** GitHub Actions cron workflows
- **Data store:** Validated JSON files in `data/` (Zod schemas in `src/types/schemas.ts`)
- **Theme repo:** Separate Shopify theme repo — PRs opened by Implementer agent
- **Notifications:** Slack incoming webhook

## Schedule Overview

```
Daily
  05:00 UTC  [data-collector]         → data/snapshots/YYYY-MM-DD.json
  06:00 UTC  [conductor]              → orchestrates daily cycle → Slack digest
             [analyst]                → data/analyses/YYYY-MM-DD.json
             [hypothesis]             → data/hypotheses/YYYY-MM-DD.json
             [ad-watchdog]            → Slack alert if ROAS below threshold
             [inventory-merchandising]→ data/inventory-reports/YYYY-MM-DD.json
             [site-speed-watchdog]    → data/speed-reports/YYYY-MM-DD.json

Weekly
  Monday     [seo-content]            → keyword opportunities, meta tag PRs
             [content-writer]         → blog drafts from SEO recommendations
             [email-optimizer]        → email flow performance report
             [landing-page-auditor]   → ad-to-page message match audit
             [review-social-proof]    → review health + social proof recommendations
             [upsell-crosssell]       → product affinity analysis
             [pricing-strategist]     → price sensitivity + discount analysis
  Wednesday  [competitor-monitor]     → competitive intelligence report

Monthly
  1st        [customer-cohort]        → cohort LTV + retention analysis

Manual
             [implementer]            → PR on theme repo (requires human approval)
  7d later   [verifier]               → statistical significance test
```

## Agent Roster (18 agents)

### Core CRO Loop
| Agent | Model | Schedule | Writes Code? |
|-------|-------|----------|-------------|
| conductor | sonnet | Daily 06:00 UTC | No |
| data-collector | sonnet | Daily 05:00 UTC | No (runs scripts) |
| analyst | sonnet | Triggered by conductor | No |
| hypothesis | sonnet | Triggered by conductor | No |
| implementer | opus | Manual trigger | Yes (Liquid/CSS/JS) |
| verifier | sonnet | Triggered by conductor | No |

### Traffic & Ads
| Agent | Model | Schedule | Writes Code? |
|-------|-------|----------|-------------|
| ad-watchdog | sonnet | Daily via conductor | No |
| landing-page-auditor | sonnet | Weekly Monday | No |

### Brand & Content
| Agent | Model | Schedule | Writes Code? |
|-------|-------|----------|-------------|
| brand-analyst | sonnet | On demand | No |
| seo-content | sonnet | Weekly Monday | Yes (meta tags) |
| content-writer | sonnet | After seo-content | Yes (blog drafts) |

### Revenue Optimization
| Agent | Model | Schedule | Writes Code? |
|-------|-------|----------|-------------|
| email-optimizer | sonnet | Weekly Monday | No |
| pricing-strategist | sonnet | Weekly Monday | No |
| upsell-crosssell | sonnet | Weekly Monday | Yes (Liquid) |

### Customer Intelligence
| Agent | Model | Schedule | Writes Code? |
|-------|-------|----------|-------------|
| review-social-proof | sonnet | Weekly Monday | Yes (Liquid) |
| customer-cohort | sonnet | Monthly 1st | No |
| competitor-monitor | sonnet | Weekly Wednesday | No |

### Operations
| Agent | Model | Schedule | Writes Code? |
|-------|-------|----------|-------------|
| inventory-merchandising | sonnet | Daily | No |
| site-speed-watchdog | sonnet | Daily | No |

## Safety Rails — NON-NEGOTIABLE

1. **Never** merge PRs automatically — human approval required
2. **Never** modify checkout code without explicit approval
3. **Never** change pricing (product prices, shipping rates, discount logic)
4. **Never** delete products, collections, or pages
5. **Never** modify customer data or order data
6. **Never** publish content as live — always draft status
7. Implementer ONLY runs when a hypothesis has `status: "approved"`
8. All theme changes go through PR review on the theme repo
9. Pricing Strategist provides recommendations only — never auto-implements
10. Competitor monitoring uses only publicly available data

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
