# CRO plan: sample store, last 28 days

*Example output of the skill on [`sample-funnel.csv`](sample-funnel.csv). Synthetic data; the period is assumed to be 28 days.*

## Where the funnel leaks

Mobile brings 70% of sessions but only 49% of orders. The biggest leak is **mobile product page → add to cart: 10.8% against 16.0% on desktop**, worth about **649 orders (€53,900) in the period** if mobile matched desktop (p < 0.001). Mobile will never fully match desktop, so the realistic opportunity is about 130–195 orders per period. A second, separate leak is **mobile checkout → purchase: 47.0% against 62.9%** (456 orders).

| Step | Segment | Rate | Best | Lost orders / period | p |
|---|---|---|---|---|---|
| Product view → Add to cart | mobile | 10.8% | desktop 16.0% | 649 | < 0.001 |
| Checkout started → Purchase | mobile | 47.0% | desktop 62.9% | 456 | < 0.001 |
| Add to cart → Checkout started | mobile | 54.1% | desktop 59.9% | 147 | < 0.001 |
| Session → Product view | mobile | 51.0% | tablet 56.1% | 135 | < 0.001 |

## Hypotheses (ranked)

### 1. Sticky add-to-cart bar on mobile product pages (PIE 25/30)
If we keep the price and an *Add to cart* button fixed at the bottom of mobile product pages, then mobile product view → add to cart will rise by 10% relative, because the button scrolls out of view on mobile and the gap to desktop is concentrated on this one step.
- **Evidence:** 10.8% vs 16.0%; 49,200 mobile product views; other mobile steps are much closer to desktop.
- **Change:** a theme section that shows when the main button leaves the viewport; same variant selection.
- **Primary metric:** mobile product view → add to cart · **Guardrails:** mobile purchase conversion, average order value
- **Test:** 13,544 visitors per variant, **21 days**. Ship if significant and guardrails hold.

### 2. Delivery cost and time next to the price on mobile (PIE 24/30)
If we show delivery cost and the expected delivery date directly under the price on mobile, then mobile add to cart will rise by 8% relative, because unexpected costs are the most cited reason for abandonment and on mobile this information sits below the fold.
- **Evidence:** the same leak as above; the checkout → purchase leak on mobile also points to late surprises.
- **Change:** move the existing shipping block into the price area for small screens.
- **Primary metric:** mobile product view → add to cart · **Guardrails:** mobile purchase conversion, return rate
- **Test:** 20,988 visitors per variant, **28 days**.

### 3. Tappable variant buttons instead of a dropdown (PIE 21/30)
If we replace the size and colour dropdowns with tappable buttons that show availability, then mobile add to cart will rise by 8% relative, because dropdowns are slow on touch screens and hide sold-out variants until after selection.
- **Test:** 20,988 visitors per variant, **28 days**. Run after hypothesis 1, on the same page, not at the same time.

### 4. Express wallets first on mobile checkout (PIE 21/30)
If we show Shop Pay, Apple Pay and Google Pay before the address form on mobile, then mobile checkout → purchase will rise, because typing an address and card on a phone is the main mobile friction at this step.
- **Test:** at +8% this needs 56 days on 102 mobile checkouts a day: **not feasible**. It becomes feasible only for a bold change (+15%: 787 per variant, 21 days). Alternatively, enable the wallets without a test, since they are standard platform settings, and watch the step rate.

## Caveats
- The gaps compare mobile with desktop; part of the difference is structural, so recovery is sized at 20–30%.
- Checkout layout changes depend on the Shopify plan. Payment methods can be switched on in every plan.
- Hypotheses 1–3 target the same step: run them one after another, not in parallel.

## Next step
Build hypothesis 1 as a theme section and launch the test on a Monday for three full weeks. Do not stop it early.
