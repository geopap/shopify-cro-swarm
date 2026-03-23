import type { Config } from '../src/lib/config.js';
import type { HotjarMetrics } from '../src/types/schemas.js';
import { yesterday } from '../src/lib/date-utils.js';

// ---------------------------------------------------------------------------
// Hotjar API helpers
// ---------------------------------------------------------------------------

const HOTJAR_API_BASE = 'https://api.hotjar.com/v2';

interface HotjarRequestOpts {
  apiKey: string;
  siteId: string;
  path: string;
  params?: Record<string, string>;
}

async function hotjarFetch<T>(opts: HotjarRequestOpts): Promise<T> {
  const url = new URL(`${HOTJAR_API_BASE}/sites/${opts.siteId}${opts.path}`);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hotjar API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Main collector
// ---------------------------------------------------------------------------

export async function collectHotjar(config: Partial<Config>): Promise<HotjarMetrics | null> {
  if (!config.HOTJAR_API_KEY || !config.HOTJAR_SITE_ID) {
    console.log('Hotjar not configured (HOTJAR_API_KEY / HOTJAR_SITE_ID missing). Skipping.');
    return null;
  }

  const apiKey = config.HOTJAR_API_KEY;
  const siteId = config.HOTJAR_SITE_ID;
  const date = yesterday();

  // ---- 1. Recordings count ----
  let recordings_count = 0;
  try {
    const recordingsRes = await hotjarFetch<{ count?: number; total?: number }>({
      apiKey,
      siteId,
      path: '/recordings',
      params: {
        date_from: date,
        date_to: date,
        limit: '1',
      },
    });
    recordings_count = recordingsRes.count ?? recordingsRes.total ?? 0;
  } catch (err) {
    console.warn('Failed to fetch Hotjar recordings count:', err);
  }

  // ---- 2. Scroll depth (from heatmaps or aggregate data) ----
  let avg_scroll_depth: number | undefined;
  try {
    const scrollRes = await hotjarFetch<{ data?: { avg_scroll_depth?: number } }>({
      apiKey,
      siteId,
      path: '/heatmaps/scroll',
      params: {
        date_from: date,
        date_to: date,
      },
    });
    avg_scroll_depth = scrollRes.data?.avg_scroll_depth;
  } catch (err) {
    console.warn('Failed to fetch Hotjar scroll depth (may require Business plan):', err);
  }

  // ---- 3. Rage clicks and frustration URLs ----
  let rage_clicks: number | undefined;
  let top_frustration_urls: string[] | undefined;
  try {
    const eventsRes = await hotjarFetch<{
      data?: {
        rage_clicks?: number;
        top_frustration_urls?: Array<{ url: string }>;
      };
    }>({
      apiKey,
      siteId,
      path: '/feedback/events',
      params: {
        date_from: date,
        date_to: date,
        event_type: 'rage_click',
      },
    });
    rage_clicks = eventsRes.data?.rage_clicks;
    top_frustration_urls = eventsRes.data?.top_frustration_urls?.map((u) => u.url).slice(0, 10);
  } catch (err) {
    console.warn('Failed to fetch Hotjar rage clicks:', err);
  }

  return {
    recordings_count,
    avg_scroll_depth,
    rage_clicks,
    top_frustration_urls,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadCollectorConfig } = await import('../src/lib/config.js');
  const config = loadCollectorConfig();
  try {
    const result = await collectHotjar(config);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Hotjar collection failed:', err);
    process.exit(1);
  }
}
