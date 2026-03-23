import { loadCollectorConfig } from '../src/lib/config.js';
import { yesterday, nowISO } from '../src/lib/date-utils.js';
import { writeSnapshot } from '../src/lib/file-store.js';
import { DailySnapshotSchema } from '../src/types/schemas.js';
import type {
  DailySnapshot,
  GA4Metrics,
  GSCMetrics,
  ShopifyMetrics,
  PlatformAds,
  HotjarMetrics,
} from '../src/types/schemas.js';

import { collectGA4 } from './collect-ga4.js';
import { collectGSC } from './collect-gsc.js';
import { collectShopify } from './collect-shopify.js';
import { collectGoogleAds, collectMetaAds } from './collect-ads.js';
import { collectHotjar } from './collect-hotjar.js';

// ---------------------------------------------------------------------------
// Defaults (used when a collector fails completely)
// ---------------------------------------------------------------------------

function zeroMetric() {
  return { value: 0, previous: 0, delta_pct: 0 };
}

function defaultGA4(): GA4Metrics {
  return {
    sessions: zeroMetric(),
    users: zeroMetric(),
    new_users: zeroMetric(),
    bounce_rate: zeroMetric(),
    avg_session_duration_sec: zeroMetric(),
    pages_per_session: zeroMetric(),
    conversion_rate: zeroMetric(),
    transactions: zeroMetric(),
    revenue: zeroMetric(),
    top_landing_pages: [],
    top_exit_pages: [],
    device_breakdown: { desktop: 0, mobile: 0, tablet: 0 },
    funnel: { product_views: 0, add_to_cart: 0, begin_checkout: 0, purchase: 0 },
  };
}

function defaultGSC(): GSCMetrics {
  return {
    total_clicks: zeroMetric(),
    total_impressions: zeroMetric(),
    avg_ctr: zeroMetric(),
    avg_position: zeroMetric(),
    top_queries: [],
    top_pages: [],
  };
}

function defaultShopify(): ShopifyMetrics {
  return {
    orders: zeroMetric(),
    aov: zeroMetric(),
    cart_abandonment_rate: zeroMetric(),
    returning_customer_rate: zeroMetric(),
    top_products: [],
    inventory_alerts: [],
  };
}

function defaultPlatformAds(): PlatformAds {
  return {
    spend: 0,
    conversions: 0,
    roas: 0,
    cpc: 0,
    ctr: 0,
    impressions: 0,
    top_campaigns: [],
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

interface CollectionResult<T> {
  source: string;
  data: T | null;
  error?: string;
}

async function safeCollect<T>(source: string, fn: () => Promise<T>): Promise<CollectionResult<T>> {
  try {
    const data = await fn();
    return { source, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${source}] Collection failed: ${message}`);
    return { source, data: null, error: message };
  }
}

async function main() {
  console.log('=== Shopify CRO Swarm — Daily Data Collection ===');
  const startTime = Date.now();
  const config = loadCollectorConfig();
  const date = yesterday();

  console.log(`Collecting data for: ${date}`);
  console.log(`Config keys present: ${Object.keys(config).join(', ') || '(none)'}`);

  // Run all collectors in parallel
  const [ga4Result, gscResult, shopifyResult, googleAdsResult, metaAdsResult, hotjarResult] =
    await Promise.allSettled([
      safeCollect('ga4', () => collectGA4(config)),
      safeCollect('gsc', () => collectGSC(config)),
      safeCollect('shopify', () => collectShopify(config)),
      safeCollect('google_ads', () => collectGoogleAds(config)),
      safeCollect('meta_ads', () => collectMetaAds(config)),
      safeCollect('hotjar', () => collectHotjar(config)),
    ]);

  // Extract results (Promise.allSettled wraps in { status, value })
  const ga4 = ga4Result.status === 'fulfilled' ? ga4Result.value : { source: 'ga4', data: null, error: 'Unexpected failure' };
  const gsc = gscResult.status === 'fulfilled' ? gscResult.value : { source: 'gsc', data: null, error: 'Unexpected failure' };
  const shopify = shopifyResult.status === 'fulfilled' ? shopifyResult.value : { source: 'shopify', data: null, error: 'Unexpected failure' };
  const googleAds = googleAdsResult.status === 'fulfilled' ? googleAdsResult.value : { source: 'google_ads', data: null, error: 'Unexpected failure' };
  const metaAds = metaAdsResult.status === 'fulfilled' ? metaAdsResult.value : { source: 'meta_ads', data: null, error: 'Unexpected failure' };
  const hotjar = hotjarResult.status === 'fulfilled' ? hotjarResult.value : { source: 'hotjar', data: null, error: 'Unexpected failure' };

  // Collect errors
  const collection_errors: Array<{ source: string; error: string; timestamp: string }> = [];
  const allResults = [ga4, gsc, shopify, googleAds, metaAds, hotjar];
  for (const result of allResults) {
    if (result.error) {
      collection_errors.push({
        source: result.source,
        error: result.error,
        timestamp: nowISO(),
      });
    }
  }

  // Build snapshot with defaults for failed collectors
  const snapshot: DailySnapshot = {
    date,
    collected_at: nowISO(),
    period: 'daily',
    comparison_period: 'previous_day',
    ga4: (ga4.data as GA4Metrics) ?? defaultGA4(),
    shopify: (shopify.data as ShopifyMetrics) ?? defaultShopify(),
    gsc: (gsc.data as GSCMetrics) ?? defaultGSC(),
    ads: {
      google_ads: (googleAds.data as PlatformAds) ?? defaultPlatformAds(),
      meta_ads: (metaAds.data as PlatformAds) ?? defaultPlatformAds(),
    },
    hotjar: (hotjar.data as HotjarMetrics | null) ?? undefined,
    collection_errors,
  };

  // Validate
  const validated = DailySnapshotSchema.parse(snapshot);

  // Write to disk
  writeSnapshot('snapshots', date, validated, DailySnapshotSchema);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const successCount = allResults.filter((r) => !r.error).length;
  const failCount = allResults.filter((r) => r.error).length;

  console.log('\n=== Collection Summary ===');
  console.log(`Date:       ${date}`);
  console.log(`Duration:   ${elapsed}s`);
  console.log(`Successful: ${successCount}/6 collectors`);
  console.log(`Failed:     ${failCount}/6 collectors`);

  if (collection_errors.length > 0) {
    console.log('\nErrors:');
    for (const err of collection_errors) {
      console.log(`  - [${err.source}] ${err.error}`);
    }
  }

  console.log(`\nSnapshot written to: data/snapshots/${date}.json`);
}

main().catch((err) => {
  console.error('Fatal error in collect-all:', err);
  process.exit(1);
});
