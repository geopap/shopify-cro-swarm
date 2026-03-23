import { google } from 'googleapis';
import { readFileSync, existsSync } from 'node:fs';
import type { Config } from '../src/lib/config.js';
import type { GA4Metrics, MetricWithDelta } from '../src/types/schemas.js';
import { yesterday, daysAgo } from '../src/lib/date-utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delta(current: number, previous: number): MetricWithDelta {
  const delta_pct = previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / Math.abs(previous)) * 100;
  return { value: current, previous, delta_pct: Math.round(delta_pct * 100) / 100 };
}

function getServiceAccountCredentials(keyEnv: string): object {
  // Could be a file path or a JSON string
  if (existsSync(keyEnv)) {
    return JSON.parse(readFileSync(keyEnv, 'utf-8'));
  }
  return JSON.parse(keyEnv);
}

async function getAuthClient(config: Partial<Config>) {
  const credentials = getServiceAccountCredentials(config.GA4_SERVICE_ACCOUNT_KEY!);
  const auth = new google.auth.GoogleAuth({
    credentials: credentials as any,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  return auth;
}

// ---------------------------------------------------------------------------
// Core query helpers
// ---------------------------------------------------------------------------

interface RunReportOpts {
  propertyId: string;
  auth: InstanceType<typeof google.auth.GoogleAuth>;
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions?: string[];
  dimensionFilter?: any;
  orderBys?: any[];
  limit?: number;
}

async function runReport(opts: RunReportOpts) {
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth: opts.auth });

  const request: any = {
    property: `properties/${opts.propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: opts.startDate, endDate: opts.endDate }],
      metrics: opts.metrics.map((name) => ({ name })),
    },
  };

  if (opts.dimensions) {
    request.requestBody.dimensions = opts.dimensions.map((name) => ({ name }));
  }
  if (opts.dimensionFilter) {
    request.requestBody.dimensionFilter = opts.dimensionFilter;
  }
  if (opts.orderBys) {
    request.requestBody.orderBys = opts.orderBys;
  }
  if (opts.limit) {
    request.requestBody.limit = opts.limit;
  }

  const res = await analyticsData.properties.runReport(request);
  return res.data;
}

function metricVal(row: any, index: number): number {
  const raw = row?.metricValues?.[index]?.value;
  return raw ? parseFloat(raw) : 0;
}

function dimVal(row: any, index: number): string {
  return row?.dimensionValues?.[index]?.value ?? '';
}

// ---------------------------------------------------------------------------
// Main collector
// ---------------------------------------------------------------------------

export async function collectGA4(config: Partial<Config>): Promise<GA4Metrics> {
  if (!config.GA4_SERVICE_ACCOUNT_KEY || !config.GA4_PROPERTY_ID) {
    throw new Error('GA4 config missing: GA4_SERVICE_ACCOUNT_KEY and GA4_PROPERTY_ID are required');
  }

  const auth = await getAuthClient(config);
  const propertyId = config.GA4_PROPERTY_ID;
  const dateToday = yesterday(); // we collect data for yesterday
  const datePrev = daysAgo(2); // day before yesterday for comparison

  // ---- 1. Core metrics for today and previous day ----
  const coreMetrics = [
    'sessions',
    'totalUsers',
    'newUsers',
    'bounceRate',
    'averageSessionDuration',
    'screenPageViewsPerSession',
    'conversions',
    'transactions',
    'totalRevenue',
  ];

  const [todayReport, prevReport] = await Promise.all([
    runReport({ propertyId, auth, startDate: dateToday, endDate: dateToday, metrics: coreMetrics }),
    runReport({ propertyId, auth, startDate: datePrev, endDate: datePrev, metrics: coreMetrics }),
  ]);

  const todayRow = todayReport.rows?.[0];
  const prevRow = prevReport.rows?.[0];

  const sessions = delta(metricVal(todayRow, 0), metricVal(prevRow, 0));
  const users = delta(metricVal(todayRow, 1), metricVal(prevRow, 1));
  const new_users = delta(metricVal(todayRow, 2), metricVal(prevRow, 2));
  const bounce_rate = delta(metricVal(todayRow, 3), metricVal(prevRow, 3));
  const avg_session_duration_sec = delta(metricVal(todayRow, 4), metricVal(prevRow, 4));
  const pages_per_session = delta(metricVal(todayRow, 5), metricVal(prevRow, 5));
  const conversions = metricVal(todayRow, 6);
  const prevConversions = metricVal(prevRow, 6);
  const txToday = metricVal(todayRow, 7);
  const txPrev = metricVal(prevRow, 7);
  const transactions = delta(txToday, txPrev);
  const revenue = delta(metricVal(todayRow, 8), metricVal(prevRow, 8));

  // Conversion rate = transactions / sessions
  const crToday = sessions.value > 0 ? (txToday / sessions.value) * 100 : 0;
  const crPrev = sessions.previous > 0 ? (txPrev / sessions.previous) * 100 : 0;
  const conversion_rate = delta(crToday, crPrev);

  // ---- 2. Funnel (event counts) ----
  const funnelEvents = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'];

  const funnelPromises = funnelEvents.map((eventName) =>
    runReport({
      propertyId,
      auth,
      startDate: dateToday,
      endDate: dateToday,
      metrics: ['eventCount'],
      dimensions: ['eventName'],
      dimensionFilter: {
        filter: { fieldName: 'eventName', stringFilter: { value: eventName, matchType: 'EXACT' } },
      },
    }),
  );

  const funnelResults = await Promise.all(funnelPromises);
  const funnel = {
    product_views: metricVal(funnelResults[0].rows?.[0], 0),
    add_to_cart: metricVal(funnelResults[1].rows?.[0], 0),
    begin_checkout: metricVal(funnelResults[2].rows?.[0], 0),
    purchase: metricVal(funnelResults[3].rows?.[0], 0),
  };

  // ---- 3. Top landing pages ----
  const landingPagesReport = await runReport({
    propertyId,
    auth,
    startDate: dateToday,
    endDate: dateToday,
    metrics: ['sessions', 'bounceRate', 'conversions'],
    dimensions: ['landingPagePlusQueryString'],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  const top_landing_pages = (landingPagesReport.rows ?? []).map((row: any) => {
    const pageSessions = metricVal(row, 0);
    const pageConversions = metricVal(row, 2);
    return {
      page: dimVal(row, 0),
      sessions: pageSessions,
      bounce_rate: metricVal(row, 1),
      conversion_rate: pageSessions > 0 ? (pageConversions / pageSessions) * 100 : 0,
    };
  });

  // ---- 4. Top exit pages ----
  const exitPagesReport = await runReport({
    propertyId,
    auth,
    startDate: dateToday,
    endDate: dateToday,
    metrics: ['sessions', 'userEngagementDuration'],
    dimensions: ['pagePathPlusQueryString'],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  const totalSessionsToday = sessions.value || 1;
  const top_exit_pages = (exitPagesReport.rows ?? []).map((row: any) => {
    const pageSessions = metricVal(row, 0);
    return {
      page: dimVal(row, 0),
      exits: pageSessions,
      exit_rate: (pageSessions / totalSessionsToday) * 100,
    };
  });

  // ---- 5. Device breakdown ----
  const deviceReport = await runReport({
    propertyId,
    auth,
    startDate: dateToday,
    endDate: dateToday,
    metrics: ['sessions'],
    dimensions: ['deviceCategory'],
  });

  const device_breakdown = { desktop: 0, mobile: 0, tablet: 0 };
  for (const row of deviceReport.rows ?? []) {
    const cat = dimVal(row, 0).toLowerCase() as keyof typeof device_breakdown;
    if (cat in device_breakdown) {
      device_breakdown[cat] = metricVal(row, 0);
    }
  }

  return {
    sessions,
    users,
    new_users,
    bounce_rate,
    avg_session_duration_sec,
    pages_per_session,
    conversion_rate,
    transactions,
    revenue,
    top_landing_pages,
    top_exit_pages,
    device_breakdown,
    funnel,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadCollectorConfig } = await import('../src/lib/config.js');
  const config = loadCollectorConfig();
  try {
    const result = await collectGA4(config);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('GA4 collection failed:', err);
    process.exit(1);
  }
}
