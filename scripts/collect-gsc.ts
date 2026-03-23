import { google } from 'googleapis';
import { readFileSync, existsSync } from 'node:fs';
import type { Config } from '../src/lib/config.js';
import type { GSCMetrics, MetricWithDelta } from '../src/types/schemas.js';
import { yesterday, daysAgo } from '../src/lib/date-utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delta(current: number, previous: number): MetricWithDelta {
  const delta_pct = previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / Math.abs(previous)) * 100;
  return { value: current, previous, delta_pct: Math.round(delta_pct * 100) / 100 };
}

function getServiceAccountCredentials(keyEnv: string): object {
  if (existsSync(keyEnv)) {
    return JSON.parse(readFileSync(keyEnv, 'utf-8'));
  }
  return JSON.parse(keyEnv);
}

async function getAuthClient(config: Partial<Config>) {
  // GSC uses the same service account as GA4
  const credentials = getServiceAccountCredentials(config.GA4_SERVICE_ACCOUNT_KEY!);
  const auth = new google.auth.GoogleAuth({
    credentials: credentials as any,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  return auth;
}

interface GSCQueryResult {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
}

async function queryGSC(
  auth: InstanceType<typeof google.auth.GoogleAuth>,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit: number,
): Promise<GSCQueryResult> {
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      type: 'web',
    },
  });
  return res.data as GSCQueryResult;
}

async function queryGSCTotals(
  auth: InstanceType<typeof google.auth.GoogleAuth>,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<{ clicks: number; impressions: number; ctr: number; position: number }> {
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      type: 'web',
    },
  });
  const data = res.data as GSCQueryResult;
  const row = data.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Main collector
// ---------------------------------------------------------------------------

export async function collectGSC(config: Partial<Config>): Promise<GSCMetrics> {
  if (!config.GA4_SERVICE_ACCOUNT_KEY || !config.GSC_SITE_URL) {
    throw new Error('GSC config missing: GA4_SERVICE_ACCOUNT_KEY and GSC_SITE_URL are required');
  }

  const auth = await getAuthClient(config);
  const siteUrl = config.GSC_SITE_URL;

  // GSC data has a ~2-3 day lag, so we query 3 days ago and 4 days ago for comparison
  const dateToday = daysAgo(3);
  const datePrev = daysAgo(4);

  // ---- 1. Totals for both periods ----
  const [todayTotals, prevTotals] = await Promise.all([
    queryGSCTotals(auth, siteUrl, dateToday, dateToday),
    queryGSCTotals(auth, siteUrl, datePrev, datePrev),
  ]);

  const total_clicks = delta(todayTotals.clicks, prevTotals.clicks);
  const total_impressions = delta(todayTotals.impressions, prevTotals.impressions);
  const avg_ctr = delta(todayTotals.ctr, prevTotals.ctr);
  const avg_position = delta(todayTotals.position, prevTotals.position);

  // ---- 2. Top queries (top 50 by clicks) ----
  const queryReport = await queryGSC(auth, siteUrl, dateToday, dateToday, ['query'], 50);
  const top_queries = (queryReport.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  // ---- 3. Top pages (top 20 by clicks) ----
  const pageReport = await queryGSC(auth, siteUrl, dateToday, dateToday, ['page'], 20);
  const top_pages = (pageReport.rows ?? []).map((row) => ({
    page: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  return {
    total_clicks,
    total_impressions,
    avg_ctr,
    avg_position,
    top_queries,
    top_pages,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadCollectorConfig } = await import('../src/lib/config.js');
  const config = loadCollectorConfig();
  try {
    const result = await collectGSC(config);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('GSC collection failed:', err);
    process.exit(1);
  }
}
