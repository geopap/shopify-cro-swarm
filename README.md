# Shopify CRO Agent Swarm

Autonomous CRO (Conversion Rate Optimization) agent swarm for Shopify stores. 26 AI agents collect metrics, analyze funnel leaks, generate ranked hypotheses, implement theme changes as PRs, and verify results with statistical tests — all on autopilot via GitHub Actions. Human-approved, data-driven conversion optimization on autopilot.

## How It Works

Every day, the swarm runs a closed-loop optimization cycle:

```
Daily
  05:00 UTC  [data-collector]           Pulls metrics from GA4, GSC, Shopify, Ads, Hotjar
  06:00 UTC  [conductor]                Orchestrates the daily cycle
             [analyst]                  Identifies the biggest funnel leak by volume
             [hypothesis]               Generates 3-5 ranked CRO hypotheses
             [ad-watchdog]              Alerts if ROAS drops below thresholds
             [inventory-merchandising]  Flags stockouts, dead stock, reorder alerts
             [site-speed-watchdog]      Tracks Core Web Vitals, alerts on regressions
             [cart-checkout-recovery]   Analyzes cart→checkout micro-funnel drop-offs
             [conductor]                Sends daily digest to Slack

Weekly (Monday)
             [seo-content]              Keyword gap analysis + meta tag optimization
             [content-writer]           Writes blog posts from SEO recommendations
             [email-optimizer]          Audits email flows, suggests A/B tests
             [landing-page-auditor]     Checks ad-to-page message match
             [review-social-proof]      Review health + social proof recommendations
             [upsell-crosssell]         Product affinity analysis + recommendations
             [pricing-strategist]       Price sensitivity + discount analysis
             [ab-test-manager]          Designs tests, monitors running experiments
             [customer-journey]         Maps multi-session paths to purchase
             [accessibility-auditor]    WCAG 2.1 compliance checks + fixes
             [retention-winback]        Churn risk scoring + win-back recommendations
             [translation-localization] i18n audit, missing/stale translations

Weekly (Wednesday)
             [competitor-monitor]       Competitive intelligence report

Monthly (1st)
             [customer-cohort]          Cohort LTV + retention analysis
             [geo-optimizer]            Geo conversion analysis + localization recs

Manual
             [brand-analyst]            Creates brand book (voice, tone, style)
             [implementer]              Implements approved hypothesis as a theme PR
  7d later   [verifier]                 Statistical significance test → KEEP / REVERT
```

You wake up to a Slack digest each morning. If a hypothesis looks good, approve it. The Implementer opens a PR. After 7 days, the Verifier tells you if it worked.

## Agent Roster (26 agents)

### Core CRO Loop

| Agent | Role | Model | Schedule |
|-------|------|-------|----------|
| **Conductor** | Orchestrates daily cycle, compiles digest, gates progression | Sonnet | Daily 06:00 UTC |
| **Data Collector** | Pulls metrics into a unified JSON snapshot | Sonnet | Daily 05:00 UTC |
| **Analyst** | Compares snapshot vs baselines, finds biggest funnel leak | Sonnet | Triggered by Conductor |
| **Hypothesis Generator** | Creates 3-5 ranked CRO hypotheses (PIE framework) | Sonnet | Triggered by Conductor |
| **Implementer** | Builds Shopify Liquid changes, opens PR | Opus | Manual trigger only |
| **Verifier** | Runs chi-squared/t-test after 7 days | Sonnet | Triggered by Conductor |
| **A/B Test Manager** | Designs tests, calculates sample sizes, monitors experiments | Sonnet | Weekly Monday |

### Traffic & Ads

| Agent | Role | Model | Schedule |
|-------|------|-------|----------|
| **Ad Watchdog** | Monitors ROAS, alerts on spend anomalies | Sonnet | Daily via Conductor |
| **Landing Page Auditor** | Audits ad-to-page message match, mobile UX, trust signals | Sonnet | Weekly Monday |

### Brand & Content

| Agent | Role | Model | Schedule |
|-------|------|-------|----------|
| **Brand Analyst** | Audits store to create brand book (voice, tone, style, visual identity) | Sonnet | On demand |
| **SEO/Content** | Keyword gap analysis, meta tag optimization (uses Semrush + GSC) | Sonnet | Weekly Monday |
| **Content Writer** | Writes full blog posts from SEO recommendations, publishes as drafts | Sonnet | After SEO agent |
| **Translation & Localization** | i18n audit, missing/stale translations, brand voice across locales | Sonnet | Weekly Monday |

### Revenue Optimization

| Agent | Role | Model | Schedule |
|-------|------|-------|----------|
| **Email Optimizer** | Audits Klaviyo/Mailchimp flows, suggests subject line tests | Sonnet | Weekly Monday |
| **Pricing Strategist** | Analyzes price sensitivity, discount effectiveness (advisory only) | Sonnet | Weekly Monday |
| **Upsell/Cross-sell** | Product affinity analysis, cart upsell recommendations | Sonnet | Weekly Monday |
| **Cart & Checkout Recovery** | Analyzes cart→checkout micro-funnel, identifies friction | Sonnet | Daily |

### Customer Intelligence

| Agent | Role | Model | Schedule |
|-------|------|-------|----------|
| **Review & Social Proof** | Monitors review health, recommends social proof placement | Sonnet | Weekly Monday |
| **Customer Cohort** | Segments customers by LTV, identifies golden path | Sonnet | Monthly 1st |
| **Customer Journey** | Maps multi-session paths, finds content that converts | Sonnet | Weekly Monday |
| **Competitor Monitor** | Tracks competitor pricing, ads, and keyword rankings | Sonnet | Weekly Wednesday |
| **Retention & Win-back** | Churn risk scoring, win-back timing recommendations | Sonnet | Weekly Monday |
| **Geo Optimizer** | Geo conversion analysis, localization recommendations | Sonnet | Monthly 1st |

### Operations

| Agent | Role | Model | Schedule |
|-------|------|-------|----------|
| **Inventory & Merchandising** | Stock alerts, dead stock flags, sort order optimization | Sonnet | Daily |
| **Site Speed Watchdog** | Core Web Vitals tracking, regression alerts | Sonnet | Daily |
| **Accessibility Auditor** | WCAG 2.1 compliance checks, opens fix PRs | Sonnet | Weekly Monday |

## Project Structure

```
shopify-cro-swarm/
├── .github/workflows/
│   ├── daily-collect.yml              # Cron: 05:00 UTC
│   ├── daily-swarm.yml                # Cron: 06:00 UTC
│   ├── weekly-agents.yml              # Cron: Monday 07:00 UTC
│   ├── weekly-competitor.yml          # Cron: Wednesday 07:00 UTC
│   ├── monthly-cohort.yml             # Cron: 1st of month
│   └── implementer.yml               # Manual dispatch only
├── agents/                            # 26 agent prompt definitions
│   ├── conductor/SKILL.md
│   ├── data-collector/SKILL.md
│   ├── analyst/SKILL.md
│   ├── hypothesis/SKILL.md
│   ├── implementer/SKILL.md
│   ├── verifier/SKILL.md
│   ├── seo-content/SKILL.md
│   ├── ad-watchdog/SKILL.md
│   ├── brand-analyst/SKILL.md
│   ├── email-optimizer/SKILL.md
│   ├── pricing-strategist/SKILL.md
│   ├── upsell-crosssell/SKILL.md
│   ├── review-social-proof/SKILL.md
│   ├── customer-cohort/SKILL.md
│   ├── competitor-monitor/SKILL.md
│   ├── landing-page-auditor/SKILL.md
│   ├── content-writer/SKILL.md
│   ├── inventory-merchandising/SKILL.md
│   ├── site-speed-watchdog/SKILL.md
│   ├── ab-test-manager/SKILL.md
│   ├── customer-journey/SKILL.md
│   ├── accessibility-auditor/SKILL.md
│   ├── retention-winback/SKILL.md
│   ├── geo-optimizer/SKILL.md
│   ├── cart-checkout-recovery/SKILL.md
│   └── translation-localization/SKILL.md
├── data/
│   ├── snapshots/                     # Daily metric snapshots
│   ├── analyses/                      # Analyst outputs
│   ├── hypotheses/                    # Generated hypotheses
│   ├── verifications/                 # Experiment results
│   ├── email-reports/                 # Email optimizer outputs
│   ├── pricing-reports/               # Pricing strategist outputs
│   ├── upsell-reports/                # Upsell/cross-sell outputs
│   ├── review-reports/                # Review & social proof outputs
│   ├── cohort-reports/                # Customer cohort outputs
│   ├── competitor-reports/            # Competitor monitor outputs
│   ├── landing-page-reports/          # Landing page auditor outputs
│   ├── content-reports/               # Content writer outputs
│   ├── inventory-reports/             # Inventory merchandising outputs
│   ├── speed-reports/                 # Site speed watchdog outputs
│   ├── ab-test-reports/               # A/B test manager outputs
│   ├── journey-reports/               # Customer journey outputs
│   ├── accessibility-reports/         # Accessibility auditor outputs
│   ├── retention-reports/             # Retention & win-back outputs
│   ├── geo-reports/                   # Geo optimizer outputs
│   ├── cart-recovery-reports/         # Cart & checkout recovery outputs
│   ├── translation-reports/           # Translation & localization outputs
│   ├── baselines.json                 # Rolling averages
│   └── experiment-log.json            # All experiments ever run
├── scripts/
│   ├── collect-all.ts                 # Orchestrates all collectors
│   ├── collect-ga4.ts                 # Google Analytics 4
│   ├── collect-gsc.ts                 # Google Search Console
│   ├── collect-shopify.ts             # Shopify Admin GraphQL
│   ├── collect-ads.ts                 # Google Ads + Meta Ads
│   ├── collect-hotjar.ts              # Hotjar (optional)
│   └── notify-slack.ts                # Slack webhook
├── src/
│   ├── types/schemas.ts               # Zod schemas for all inter-agent data
│   └── lib/                           # Config, date utils, file store
├── CLAUDE.md                          # Agent instructions & safety rails
├── package.json
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 22+
- A Shopify store with a custom app (Admin API access)
- Google Cloud project with GA4 Data API + Search Console API enabled
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone and install

```bash
git clone https://github.com/geopap/shopify-cro-swarm.git
cd shopify-cro-swarm
npm install
```

### 2. Configure API credentials

```bash
cp .env.example .env
```

Fill in your credentials. At minimum you need:

| Service | What to set up | Used by |
|---------|---------------|---------|
| **GA4** | Google Cloud service account with Analytics Data API enabled | Data Collector, Analyst |
| **GSC** | Same service account, added as user in Search Console | Data Collector, SEO Agent |
| **Shopify** | Custom app with Admin API access | Data Collector, Implementer, Inventory |
| **Google Ads** | OAuth2 credentials + developer token | Data Collector, Ad Watchdog |
| **Meta Ads** | System user token with `ads_read` permission | Data Collector, Ad Watchdog |
| **Slack** | Incoming webhook URL for alerts channel | Conductor, Ad Watchdog |
| **GitHub** | PAT with repo write access to your theme repo | Implementer, SEO Agent |

Optional integrations:

| Service | What to set up | Used by |
|---------|---------------|---------|
| **Hotjar** | API key (Business plan required) | Data Collector |
| **Semrush** | API key | SEO Agent |
| **Klaviyo** | Private API key | Email Optimizer |
| **Judge.me** | API token | Review & Social Proof |
| **PageSpeed Insights** | API key | Site Speed Watchdog |
| **Competitor URLs** | Comma-separated list | Competitor Monitor |

### 3. Test data collection

```bash
npm run collect
```

This runs all collectors and writes a snapshot to `data/snapshots/YYYY-MM-DD.json`.

### 4. Push to GitHub and add secrets

Add all your `.env` values as [GitHub repository secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions). Plus `ANTHROPIC_API_KEY` for the Claude agents.

### 5. Enable the workflows

The GitHub Actions workflows run on cron schedules:

- **Daily collection** at 05:00 UTC
- **Daily swarm** (analysis + hypotheses + digest) at 06:00 UTC
- **Weekly agents** (SEO, email, landing pages, reviews, upsells, pricing) on Mondays at 07:00 UTC
- **Competitor monitoring** on Wednesdays at 07:00 UTC
- **Customer cohort analysis** on the 1st of each month

You can also trigger any workflow manually from the Actions tab.

### 6. Review your first digest

Check Slack for your daily digest:
- Key metrics vs 7-day averages
- The biggest conversion bottleneck
- Top CRO hypothesis with expected impact
- Ad spend alerts
- Inventory alerts
- Site speed status

### 7. Approve and implement

When you see a hypothesis you like:
1. Update its status to `"approved"` in the hypotheses JSON file
2. Go to Actions > "Implement Hypothesis" > Run workflow
3. Enter the hypothesis ID (e.g., `HYP-2026-03-23-001`)
4. Review the PR on your theme repo
5. Merge when ready

After 7 days, the Verifier tells you if the change had a statistically significant impact.

## Safety Rails

Enforced across all agents — **cannot be overridden**:

- PRs are **never** merged automatically — human approval required
- Checkout code is **never** modified without explicit approval
- Pricing is **never** changed automatically — advisory recommendations only
- Products, collections, and pages are **never** deleted
- Content is **never** published as live — always draft status
- The Implementer **only** runs on hypotheses with `status: "approved"`
- Competitor monitoring uses only publicly available data

## Customization

### Adjusting thresholds

- **ROAS alerts:** Edit `agents/ad-watchdog/SKILL.md`
- **Stock alerts:** Edit `agents/inventory-merchandising/SKILL.md`
- **Speed alerts:** Edit `agents/site-speed-watchdog/SKILL.md`

### Changing the schedule

Edit the `cron` expressions in `.github/workflows/*.yml`. Times are in UTC.

### Adding data sources

Create a new collector in `scripts/`, add its schema to `src/types/schemas.ts`, and call it from `scripts/collect-all.ts`.

### Modifying agent behavior

Each agent's prompt is in `agents/<name>/SKILL.md`. Edit these to change analysis logic, hypothesis frameworks, or implementation patterns.

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Claude API (Sonnet for 25 agents) | ~$150-350 |
| Claude API (Opus for Implementer) | ~$20-50 |
| GitHub Actions | Free tier |
| **Total** | **~$170-400/mo** |

## Tech Stack

- **Runtime:** Node.js 22, TypeScript (strict), ESM
- **AI:** Claude Sonnet + Opus via [Anthropic API](https://docs.anthropic.com/)
- **Scheduling:** GitHub Actions cron workflows
- **Data sources:** GA4, GSC, Semrush, Shopify Admin GraphQL, Google Ads, Meta Marketing API, Hotjar, Klaviyo, Judge.me, PageSpeed Insights
- **Validation:** Zod schemas for all inter-agent JSON
- **Testing:** Vitest
- **Notifications:** Slack incoming webhooks

## License

MIT
