# Shopify CRO Agent Swarm

Autonomous CRO (Conversion Rate Optimization) agent swarm for Shopify stores. 8 AI agents collect metrics (GA4, GSC, Shopify, Google/Meta Ads), analyze funnel leaks, generate ranked hypotheses, implement theme changes as PRs, and verify results with statistical tests — all on autopilot via GitHub Actions. Human-approved, data-driven conversion optimization on autopilot.

## How It Works

Every day, the swarm runs a closed-loop optimization cycle:

```
05:00 UTC  [data-collector]  Pulls metrics from GA4, GSC, Shopify, Google/Meta Ads, Hotjar
06:00 UTC  [conductor]       Orchestrates the daily cycle
           [analyst]         Identifies the biggest funnel leak by volume
           [hypothesis]      Generates 3-5 ranked CRO hypotheses
           [ad-watchdog]     Alerts if ROAS drops below thresholds
           [conductor]       Sends daily digest to Slack
Manual     [implementer]     Implements approved hypothesis as a PR on your theme repo
7d later   [verifier]        Runs statistical significance test → KEEP / REVERT / EXTEND
Monday     [seo-content]     Finds keyword opportunities, optimizes meta tags, drafts content
```

You wake up to a Slack digest each morning. If a hypothesis looks good, approve it. The Implementer opens a PR. After 7 days, the Verifier tells you if it worked. Rinse and repeat.

## Agent Roster

| Agent | Role | Model | Schedule |
|-------|------|-------|----------|
| **Conductor** | Orchestrates daily cycle, compiles digest, gates progression | Sonnet | Daily 06:00 UTC |
| **Data Collector** | Pulls metrics into a unified JSON snapshot | Sonnet | Daily 05:00 UTC |
| **Analyst** | Compares snapshot vs baselines, finds biggest funnel leak | Sonnet | Triggered by Conductor |
| **Hypothesis Generator** | Creates 3-5 ranked CRO hypotheses (PIE framework) | Sonnet | Triggered by Conductor |
| **Implementer** | Builds Shopify Liquid changes, opens PR | Opus | Manual trigger only |
| **Verifier** | Runs chi-squared/t-test after 7 days | Sonnet | Triggered by Conductor |
| **SEO/Content** | Keyword gap analysis, meta tag optimization, content drafts | Sonnet | Weekly (Monday) |
| **Ad Watchdog** | Monitors ROAS, alerts on spend anomalies | Sonnet | Daily via Conductor |

## Project Structure

```
shopify-cro-swarm/
├── .github/workflows/
│   ├── daily-collect.yml        # Cron: 05:00 UTC
│   ├── daily-swarm.yml          # Cron: 06:00 UTC
│   ├── implementer.yml          # Manual dispatch only
│   └── weekly-seo.yml           # Cron: Monday 07:00 UTC
├── agents/
│   ├── conductor/SKILL.md       # Orchestrator prompt
│   ├── data-collector/SKILL.md
│   ├── analyst/SKILL.md
│   ├── hypothesis/SKILL.md
│   ├── implementer/SKILL.md
│   ├── verifier/SKILL.md
│   ├── seo-content/SKILL.md
│   └── ad-watchdog/SKILL.md
├── data/
│   ├── snapshots/               # Daily metric snapshots (JSON)
│   ├── analyses/                # Analyst outputs
│   ├── hypotheses/              # Generated hypotheses
│   ├── verifications/           # Experiment results
│   ├── baselines.json           # Rolling averages
│   └── experiment-log.json      # All experiments ever run
├── scripts/
│   ├── collect-all.ts           # Orchestrates all collectors
│   ├── collect-ga4.ts           # Google Analytics 4
│   ├── collect-gsc.ts           # Google Search Console
│   ├── collect-shopify.ts       # Shopify Admin GraphQL
│   ├── collect-ads.ts           # Google Ads + Meta Ads
│   ├── collect-hotjar.ts        # Hotjar (optional)
│   └── notify-slack.ts          # Slack webhook
├── src/
│   ├── types/schemas.ts         # Zod schemas for all inter-agent data
│   └── lib/                     # Config, date utils, file store
├── CLAUDE.md                    # Agent instructions & safety rails
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
git clone https://github.com/YOUR_USERNAME/shopify-cro-swarm.git
cd shopify-cro-swarm
npm install
```

### 2. Configure API credentials

```bash
cp .env.example .env
```

Fill in your credentials. At minimum you need:

| Service | What to set up |
|---------|---------------|
| **GA4** | Google Cloud service account with Analytics Data API enabled. Get the property ID. |
| **GSC** | Same service account, added as a user in Search Console. |
| **Shopify** | Custom app with Admin API access (`read_orders`, `read_products`, `read_themes`, `write_themes`). |
| **Google Ads** | OAuth2 credentials + developer token. |
| **Meta Ads** | System user token with `ads_read` permission. |
| **Hotjar** | API key (Business plan required). Optional. |
| **Slack** | Incoming webhook URL for your alerts channel. |
| **GitHub** | PAT with repo write access to your Shopify theme repo. |

### 3. Test data collection

```bash
npm run collect
```

This runs all collectors and writes a snapshot to `data/snapshots/YYYY-MM-DD.json`. Check that the data looks correct.

### 4. Push to GitHub and add secrets

Add all your `.env` values as [GitHub repository secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions). Plus `ANTHROPIC_API_KEY` for the Claude agents.

### 5. Enable the workflows

The GitHub Actions workflows are configured with cron schedules. Once pushed, they'll start running automatically:

- **Daily collection** at 05:00 UTC
- **Daily swarm** (analysis + hypotheses + digest) at 06:00 UTC
- **Weekly SEO review** on Mondays at 07:00 UTC

You can also trigger any workflow manually from the Actions tab.

### 6. Review your first digest

The next morning, check Slack for your daily digest. It will show:
- Key metrics vs 7-day averages
- The biggest conversion bottleneck
- Top CRO hypothesis with expected impact
- Ad spend alerts (if any)

### 7. Approve and implement

When you see a hypothesis you like:
1. Update its status to `"approved"` in the hypotheses JSON file
2. Go to Actions > "Implement Hypothesis" > Run workflow
3. Enter the hypothesis ID (e.g., `HYP-2026-03-23-001`)
4. Review the PR on your theme repo
5. Merge when ready

After 7 days, the Verifier will tell you if the change had a statistically significant impact.

## Safety Rails

These are enforced across all agents and **cannot be overridden**:

- PRs are **never** merged automatically — human approval required
- Checkout code is **never** modified without explicit approval
- Pricing (product prices, shipping rates, discounts) is **never** changed
- Products, collections, and pages are **never** deleted
- The Implementer **only** runs on hypotheses with `status: "approved"`
- All theme changes go through PR review

## Customization

### Adjusting ROAS thresholds

Edit `agents/ad-watchdog/SKILL.md` to change the default alert thresholds for your store's margins and ad strategy.

### Changing the schedule

Edit the `cron` expressions in `.github/workflows/*.yml`. Times are in UTC.

### Adding data sources

Create a new collector script in `scripts/`, add its metrics to the Zod schema in `src/types/schemas.ts`, and call it from `scripts/collect-all.ts`.

### Modifying agent behavior

Each agent's instructions are in `agents/<name>/SKILL.md`. These are the prompts that Claude receives — edit them to change how agents analyze data, generate hypotheses, or implement changes.

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Claude API (Sonnet for 6 agents) | ~$50-120 |
| Claude API (Opus for Implementer) | ~$20-50 |
| GitHub Actions | Free tier |
| **Total** | **~$70-170/mo** |

## Tech Stack

- **Runtime:** Node.js 22, TypeScript (strict), ESM
- **AI:** Claude Sonnet + Opus via [Anthropic API](https://docs.anthropic.com/)
- **Scheduling:** GitHub Actions cron workflows
- **Data sources:** GA4 Data API, Google Search Console, Shopify Admin GraphQL, Google Ads, Meta Marketing API, Hotjar
- **Validation:** Zod schemas for all inter-agent JSON
- **Testing:** Vitest (43 tests)
- **Notifications:** Slack incoming webhooks

## License

MIT
