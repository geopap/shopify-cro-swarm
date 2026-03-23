import { describe, it, expect } from 'vitest';
import {
  DailySnapshotSchema,
  AnalysisSchema,
  HypothesisBatchSchema,
  ExperimentLogSchema,
  BaselinesSchema,
  AdAlertSchema,
} from '../types/schemas.js';

// ============================================================
// Helpers — reusable fixture fragments for test data
// ============================================================

function metricWithDelta(value: number, previous: number) {
  return {
    value,
    previous,
    delta_pct: previous === 0 ? 0 : ((value - previous) / previous) * 100,
  };
}

function makePlatformAds(spend: number) {
  return {
    spend,
    conversions: 12,
    roas: 3.2,
    cpc: 0.85,
    ctr: 2.1,
    impressions: 45000,
    top_campaigns: [
      {
        campaign_id: 'camp-001',
        name: 'Prospecting - Main Collection',
        spend: spend * 0.6,
        conversions: 7,
        roas: 3.5,
      },
    ],
  };
}

// ============================================================
// DailySnapshotSchema
// ============================================================

function validSnapshot() {
  return {
    date: '2026-03-22',
    collected_at: '2026-03-22T06:00:00Z',
    period: 'daily' as const,
    comparison_period: 'previous_day' as const,
    ga4: {
      sessions: metricWithDelta(1210, 1185),
      users: metricWithDelta(980, 960),
      new_users: metricWithDelta(620, 605),
      bounce_rate: metricWithDelta(52.3, 53.1),
      avg_session_duration_sec: metricWithDelta(134, 128),
      pages_per_session: metricWithDelta(3.4, 3.2),
      conversion_rate: metricWithDelta(1.1, 1.0),
      transactions: metricWithDelta(13, 12),
      revenue: metricWithDelta(2145.5, 1980.0),
      top_landing_pages: [
        { page: '/', sessions: 420, bounce_rate: 48.0, conversion_rate: 0.8 },
        {
          page: '/collections/frying-pans',
          sessions: 185,
          bounce_rate: 38.5,
          conversion_rate: 1.9,
        },
      ],
      top_exit_pages: [
        { page: '/cart', exits: 95, exit_rate: 62.3 },
        { page: '/checkout', exits: 40, exit_rate: 28.1 },
      ],
      device_breakdown: { desktop: 45, mobile: 50, tablet: 5 },
      funnel: {
        product_views: 680,
        add_to_cart: 95,
        begin_checkout: 42,
        purchase: 13,
      },
    },
    shopify: {
      orders: metricWithDelta(13, 12),
      aov: metricWithDelta(165.04, 165.0),
      cart_abandonment_rate: metricWithDelta(69.2, 71.5),
      returning_customer_rate: metricWithDelta(28.4, 26.0),
      top_products: [
        {
          product_id: 'gid://shopify/Product/8001',
          title: 'Premium Product A',
          units_sold: 5,
          revenue: 595.0,
          conversion_rate: 2.7,
        },
      ],
      inventory_alerts: [
        {
          product_id: 'gid://shopify/Product/8005',
          title: 'Premium Product B',
          inventory_quantity: 3,
        },
      ],
    },
    gsc: {
      total_clicks: metricWithDelta(320, 305),
      total_impressions: metricWithDelta(18500, 17800),
      avg_ctr: metricWithDelta(1.73, 1.71),
      avg_position: metricWithDelta(18.2, 19.1),
      top_queries: [
        {
          query: 'premium carbon steel pan',
          clicks: 28,
          impressions: 1200,
          ctr: 2.33,
          position: 8.4,
        },
      ],
      top_pages: [
        {
          page: '/collections/frying-pans',
          clicks: 45,
          impressions: 2800,
          ctr: 1.6,
          position: 12.3,
        },
      ],
    },
    ads: {
      google_ads: makePlatformAds(180),
      meta_ads: makePlatformAds(220),
    },
    hotjar: {
      recordings_count: 340,
      avg_scroll_depth: 62.5,
      rage_clicks: 14,
      top_frustration_urls: ['/products/carbon-steel-skillet-28cm'],
    },
    collection_errors: [],
  };
}

describe('DailySnapshotSchema', () => {
  it('parses a valid daily snapshot', () => {
    const result = DailySnapshotSchema.parse(validSnapshot());
    expect(result.date).toBe('2026-03-22');
    expect(result.ga4.sessions.value).toBe(1210);
    expect(result.shopify.top_products[0].title).toBe('Premium Product A');
  });

  it('accepts snapshot without optional hotjar field', () => {
    const data = validSnapshot();
    delete (data as Record<string, unknown>).hotjar;
    const result = DailySnapshotSchema.parse(data);
    expect(result.hotjar).toBeUndefined();
  });

  it('rejects missing date', () => {
    const data = validSnapshot();
    delete (data as Record<string, unknown>).date;
    expect(() => DailySnapshotSchema.parse(data)).toThrow();
  });

  it('rejects invalid date format', () => {
    const data = validSnapshot();
    data.date = '22/03/2026';
    expect(() => DailySnapshotSchema.parse(data)).toThrow();
  });

  it('rejects invalid period enum value', () => {
    const data = validSnapshot();
    (data as Record<string, unknown>).period = 'yearly';
    expect(() => DailySnapshotSchema.parse(data)).toThrow();
  });

  it('rejects when ga4 is missing', () => {
    const data = validSnapshot();
    delete (data as Record<string, unknown>).ga4;
    expect(() => DailySnapshotSchema.parse(data)).toThrow();
  });

  it('rejects non-numeric metric values', () => {
    const data = validSnapshot();
    (data.ga4.sessions as Record<string, unknown>).value = 'not-a-number';
    expect(() => DailySnapshotSchema.parse(data)).toThrow();
  });
});

// ============================================================
// AnalysisSchema
// ============================================================

function validAnalysis() {
  return {
    date: '2026-03-22',
    snapshot_date: '2026-03-22',
    analyst_model: 'claude-opus-4-6',
    summary:
      'Cart abandonment remains the biggest revenue leak at 69.2%. The checkout funnel loses 55.8% of users between add-to-cart and purchase. Mobile bounce rate is elevated at 58% vs 45% desktop.',
    biggest_leak: {
      stage: 'revenue' as const,
      metric: 'cart_abandonment_rate',
      current_value: 69.2,
      baseline_value: 65.0,
      impact_estimate:
        'Reducing cart abandonment by 5pp could yield ~EUR 320/day in recovered revenue',
      evidence: [
        'Cart page is top exit page with 62.3% exit rate',
        'Checkout begin-to-purchase drop-off is 69%',
        'Hotjar shows 14 rage clicks on product pages',
      ],
    },
    anomalies: [
      {
        metric: 'rage_clicks',
        source: 'hotjar',
        value: 14,
        expected_range: { low: 2, high: 8 },
        severity: 'warning' as const,
        possible_causes: [
          'Broken size selector on mobile PDP',
          'Slow-loading product images',
        ],
      },
    ],
    trends: [
      {
        metric: 'conversion_rate',
        direction: 'improving' as const,
        days_trending: 5,
        note: 'Conversion rate has risen from 0.85% to 1.1% over the past 5 days following PDP layout tweak.',
      },
    ],
    recommendations_for_hypothesis: [
      'Simplify the mobile checkout flow — reduce form fields',
      'Add trust badges near the checkout CTA on cart page',
      'Fix rage-click hotspot on PDP size selector',
    ],
  };
}

describe('AnalysisSchema', () => {
  it('parses a valid analysis', () => {
    const result = AnalysisSchema.parse(validAnalysis());
    expect(result.biggest_leak.stage).toBe('revenue');
    expect(result.anomalies).toHaveLength(1);
  });

  it('rejects invalid funnel stage', () => {
    const data = validAnalysis();
    (data.biggest_leak as Record<string, unknown>).stage = 'checkout';
    expect(() => AnalysisSchema.parse(data)).toThrow();
  });

  it('rejects invalid severity value', () => {
    const data = validAnalysis();
    (data.anomalies[0] as Record<string, unknown>).severity = 'urgent';
    expect(() => AnalysisSchema.parse(data)).toThrow();
  });

  it('rejects missing summary', () => {
    const data = validAnalysis();
    delete (data as Record<string, unknown>).summary;
    expect(() => AnalysisSchema.parse(data)).toThrow();
  });

  it('rejects missing analyst_model', () => {
    const data = validAnalysis();
    delete (data as Record<string, unknown>).analyst_model;
    expect(() => AnalysisSchema.parse(data)).toThrow();
  });
});

// ============================================================
// HypothesisBatchSchema
// ============================================================

function validHypothesisBatch() {
  return {
    date: '2026-03-22',
    hypotheses: [
      {
        id: 'hyp-2026-03-22-001',
        date: '2026-03-22',
        analysis_date: '2026-03-22',
        rank: 1,
        title: 'Add trust badges to cart page above checkout CTA',
        framework: 'PIE' as const,
        scores: { potential: 8, importance: 9, ease: 7, total: 24 },
        hypothesis_statement:
          'If we add trust badges (secure checkout, free returns, EUR payment icons) above the checkout button on the cart page, then cart-to-checkout rate will increase because visitors currently lack visible trust signals at the decision point.',
        change_description:
          'Insert a row of trust badge icons (SSL lock, free returns, Klarna/iDEAL logos) directly above the Checkout button in the cart template.',
        target_page: '/cart',
        target_metric: 'cart_to_checkout_rate',
        expected_lift_pct: 12,
        implementation_type: 'liquid_template' as const,
        risk_level: 'low' as const,
        status: 'proposed' as const,
      },
      {
        id: 'hyp-2026-03-22-002',
        date: '2026-03-22',
        analysis_date: '2026-03-22',
        rank: 2,
        title: 'Fix mobile PDP size selector tap targets',
        framework: 'PIE' as const,
        scores: { potential: 7, importance: 8, ease: 8, total: 23 },
        hypothesis_statement:
          'If we increase the tap target size of the size/variant selector on mobile PDP, then add-to-cart rate will increase because Hotjar shows rage clicks on the current small selectors.',
        change_description:
          'Increase variant selector button min-height to 44px and add 8px gap between options on mobile viewports.',
        target_page: '/products/*',
        target_metric: 'add_to_cart_rate',
        expected_lift_pct: 8,
        implementation_type: 'liquid_template' as const,
        risk_level: 'low' as const,
        status: 'proposed' as const,
      },
    ],
  };
}

describe('HypothesisBatchSchema', () => {
  it('parses a valid hypothesis batch', () => {
    const result = HypothesisBatchSchema.parse(validHypothesisBatch());
    expect(result.hypotheses).toHaveLength(2);
    expect(result.hypotheses[0].rank).toBe(1);
  });

  it('rejects empty hypotheses array', () => {
    const data = validHypothesisBatch();
    data.hypotheses = [];
    expect(() => HypothesisBatchSchema.parse(data)).toThrow();
  });

  it('rejects rank outside 1-5', () => {
    const data = validHypothesisBatch();
    data.hypotheses[0].rank = 0;
    expect(() => HypothesisBatchSchema.parse(data)).toThrow();
  });

  it('rejects score above 10', () => {
    const data = validHypothesisBatch();
    data.hypotheses[0].scores.potential = 11;
    expect(() => HypothesisBatchSchema.parse(data)).toThrow();
  });

  it('rejects invalid framework enum', () => {
    const data = validHypothesisBatch();
    (data.hypotheses[0] as Record<string, unknown>).framework = 'RICE';
    expect(() => HypothesisBatchSchema.parse(data)).toThrow();
  });

  it('rejects invalid implementation_type', () => {
    const data = validHypothesisBatch();
    (data.hypotheses[0] as Record<string, unknown>).implementation_type = 'css_only';
    expect(() => HypothesisBatchSchema.parse(data)).toThrow();
  });

  it('rejects more than 5 hypotheses', () => {
    const data = validHypothesisBatch();
    const base = data.hypotheses[0];
    data.hypotheses = Array.from({ length: 6 }, (_, i) => ({
      ...base,
      id: `hyp-${i}`,
      rank: Math.min(i + 1, 5) as 1 | 2 | 3 | 4 | 5,
    }));
    expect(() => HypothesisBatchSchema.parse(data)).toThrow();
  });
});

// ============================================================
// ExperimentLogSchema
// ============================================================

function validExperimentLog() {
  return {
    experiments: [
      {
        id: 'exp-001',
        hypothesis_id: 'hyp-2026-03-20-001',
        status: 'monitoring' as const,
        deployed_at: '2026-03-20T14:30:00Z',
        pr_url: 'https://github.com/example/theme/pull/42',
        pr_number: 42,
        theme_branch: 'exp/trust-badges-cart',
        changes_summary:
          'Added trust badge row (SSL, free returns, Klarna) above checkout CTA in cart.liquid',
        baseline_metrics: {
          cart_to_checkout_rate: 44.2,
          checkout_completion_rate: 31.0,
        },
        current_metrics: {
          cart_to_checkout_rate: 47.8,
          checkout_completion_rate: 32.1,
        },
      },
    ],
    last_updated: '2026-03-22T06:05:00Z',
  };
}

describe('ExperimentLogSchema', () => {
  it('parses a valid experiment log', () => {
    const result = ExperimentLogSchema.parse(validExperimentLog());
    expect(result.experiments).toHaveLength(1);
    expect(result.experiments[0].status).toBe('monitoring');
  });

  it('accepts experiment without optional fields', () => {
    const data = validExperimentLog();
    delete (data.experiments[0] as Record<string, unknown>).deployed_at;
    delete (data.experiments[0] as Record<string, unknown>).pr_url;
    delete (data.experiments[0] as Record<string, unknown>).pr_number;
    delete (data.experiments[0] as Record<string, unknown>).theme_branch;
    delete (data.experiments[0] as Record<string, unknown>).current_metrics;
    delete (data.experiments[0] as Record<string, unknown>).verification;
    const result = ExperimentLogSchema.parse(data);
    expect(result.experiments[0].pr_url).toBeUndefined();
  });

  it('rejects invalid experiment status', () => {
    const data = validExperimentLog();
    (data.experiments[0] as Record<string, unknown>).status = 'cancelled';
    expect(() => ExperimentLogSchema.parse(data)).toThrow();
  });

  it('rejects invalid pr_url', () => {
    const data = validExperimentLog();
    data.experiments[0].pr_url = 'not-a-url';
    expect(() => ExperimentLogSchema.parse(data)).toThrow();
  });

  it('rejects missing last_updated', () => {
    const data = validExperimentLog();
    delete (data as Record<string, unknown>).last_updated;
    expect(() => ExperimentLogSchema.parse(data)).toThrow();
  });
});

// ============================================================
// BaselinesSchema
// ============================================================

function validBaselines() {
  return {
    computed_at: '2026-03-22T06:00:00Z',
    period_days: 30,
    metrics: {
      daily_sessions: { mean: 1195, stddev: 85 },
      conversion_rate: { mean: 1.02, stddev: 0.18 },
      aov: { mean: 164.5, stddev: 12.3 },
      daily_revenue: { mean: 1980, stddev: 320 },
      bounce_rate: { mean: 53.0, stddev: 3.2 },
      cart_abandonment_rate: { mean: 70.1, stddev: 4.5 },
      google_ads_roas: { mean: 3.1, stddev: 0.6 },
      meta_ads_roas: { mean: 2.8, stddev: 0.5 },
      avg_position: { mean: 18.8, stddev: 1.4 },
      organic_ctr: { mean: 1.7, stddev: 0.15 },
    },
  };
}

describe('BaselinesSchema', () => {
  it('parses valid baselines', () => {
    const result = BaselinesSchema.parse(validBaselines());
    expect(result.period_days).toBe(30);
    expect(result.metrics.daily_sessions.mean).toBe(1195);
  });

  it('rejects missing metric field', () => {
    const data = validBaselines();
    delete (data.metrics as Record<string, unknown>).conversion_rate;
    expect(() => BaselinesSchema.parse(data)).toThrow();
  });

  it('rejects non-numeric stddev', () => {
    const data = validBaselines();
    (data.metrics.daily_sessions as Record<string, unknown>).stddev = 'high';
    expect(() => BaselinesSchema.parse(data)).toThrow();
  });

  it('rejects missing computed_at', () => {
    const data = validBaselines();
    delete (data as Record<string, unknown>).computed_at;
    expect(() => BaselinesSchema.parse(data)).toThrow();
  });

  it('rejects invalid datetime format for computed_at', () => {
    const data = validBaselines();
    data.computed_at = '22-03-2026';
    expect(() => BaselinesSchema.parse(data)).toThrow();
  });
});

// ============================================================
// AdAlertSchema
// ============================================================

function validAdAlert() {
  return {
    date: '2026-03-22',
    overall_level: 'WARNING' as const,
    alerts: [
      {
        platform: 'meta_ads' as const,
        level: 'WARNING' as const,
        campaign_id: 'camp-meta-003',
        campaign_name: 'Retargeting - Cart Abandoners',
        metric: 'roas',
        value: 1.2,
        threshold: 2.0,
        consecutive_days: 3,
        recommended_action:
          'Pause campaign and review audience — ROAS has been below 2.0 for 3 consecutive days.',
      },
    ],
  };
}

describe('AdAlertSchema', () => {
  it('parses a valid ad alert', () => {
    const result = AdAlertSchema.parse(validAdAlert());
    expect(result.overall_level).toBe('WARNING');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].consecutive_days).toBe(3);
  });

  it('accepts alert without optional campaign fields', () => {
    const data = validAdAlert();
    delete (data.alerts[0] as Record<string, unknown>).campaign_id;
    delete (data.alerts[0] as Record<string, unknown>).campaign_name;
    const result = AdAlertSchema.parse(data);
    expect(result.alerts[0].campaign_id).toBeUndefined();
  });

  it('accepts OK level with empty alerts array', () => {
    const data = {
      date: '2026-03-22',
      overall_level: 'OK' as const,
      alerts: [],
    };
    const result = AdAlertSchema.parse(data);
    expect(result.alerts).toHaveLength(0);
  });

  it('rejects invalid alert level', () => {
    const data = validAdAlert();
    (data as Record<string, unknown>).overall_level = 'DANGER';
    expect(() => AdAlertSchema.parse(data)).toThrow();
  });

  it('rejects invalid platform', () => {
    const data = validAdAlert();
    (data.alerts[0] as Record<string, unknown>).platform = 'tiktok_ads';
    expect(() => AdAlertSchema.parse(data)).toThrow();
  });

  it('rejects missing metric field in alert', () => {
    const data = validAdAlert();
    delete (data.alerts[0] as Record<string, unknown>).metric;
    expect(() => AdAlertSchema.parse(data)).toThrow();
  });

  it('rejects missing date', () => {
    const data = validAdAlert();
    delete (data as Record<string, unknown>).date;
    expect(() => AdAlertSchema.parse(data)).toThrow();
  });
});
