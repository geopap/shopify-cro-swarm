import { z } from 'zod/v4';

// ============================================================
// Shared primitives
// ============================================================

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ISODateTime = z.iso.datetime();

/** A metric value paired with its previous-period value and % change. */
export const MetricWithDelta = z.object({
  value: z.number(),
  previous: z.number(),
  delta_pct: z.number(),
});
export type MetricWithDelta = z.infer<typeof MetricWithDelta>;

// ============================================================
// GA4 Metrics
// ============================================================

export const LandingPage = z.object({
  page: z.string(),
  sessions: z.number(),
  bounce_rate: z.number(),
  conversion_rate: z.number(),
});

export const ExitPage = z.object({
  page: z.string(),
  exits: z.number(),
  exit_rate: z.number(),
});

export const GA4Metrics = z.object({
  sessions: MetricWithDelta,
  users: MetricWithDelta,
  new_users: MetricWithDelta,
  bounce_rate: MetricWithDelta,
  avg_session_duration_sec: MetricWithDelta,
  pages_per_session: MetricWithDelta,
  conversion_rate: MetricWithDelta,
  transactions: MetricWithDelta,
  revenue: MetricWithDelta,
  top_landing_pages: z.array(LandingPage).max(20),
  top_exit_pages: z.array(ExitPage).max(10),
  device_breakdown: z.object({
    desktop: z.number(),
    mobile: z.number(),
    tablet: z.number(),
  }),
  funnel: z.object({
    product_views: z.number(),
    add_to_cart: z.number(),
    begin_checkout: z.number(),
    purchase: z.number(),
  }),
});
export type GA4Metrics = z.infer<typeof GA4Metrics>;

// ============================================================
// Shopify Metrics
// ============================================================

export const TopProduct = z.object({
  product_id: z.string(),
  title: z.string(),
  units_sold: z.number(),
  revenue: z.number(),
  conversion_rate: z.number(),
});

export const InventoryAlert = z.object({
  product_id: z.string(),
  title: z.string(),
  inventory_quantity: z.number(),
});

export const ShopifyMetrics = z.object({
  orders: MetricWithDelta,
  aov: MetricWithDelta,
  cart_abandonment_rate: MetricWithDelta,
  returning_customer_rate: MetricWithDelta,
  top_products: z.array(TopProduct).max(20),
  inventory_alerts: z.array(InventoryAlert),
});
export type ShopifyMetrics = z.infer<typeof ShopifyMetrics>;

// ============================================================
// Google Search Console Metrics
// ============================================================

export const SearchQuery = z.object({
  query: z.string(),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});

export const SearchPage = z.object({
  page: z.string(),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});

export const GSCMetrics = z.object({
  total_clicks: MetricWithDelta,
  total_impressions: MetricWithDelta,
  avg_ctr: MetricWithDelta,
  avg_position: MetricWithDelta,
  top_queries: z.array(SearchQuery).max(50),
  top_pages: z.array(SearchPage).max(20),
});
export type GSCMetrics = z.infer<typeof GSCMetrics>;

// ============================================================
// Ads Metrics (Google + Meta)
// ============================================================

export const CampaignMetrics = z.object({
  campaign_id: z.string(),
  name: z.string(),
  spend: z.number(),
  conversions: z.number(),
  roas: z.number(),
});

export const PlatformAds = z.object({
  spend: z.number(),
  conversions: z.number(),
  roas: z.number(),
  cpc: z.number(),
  ctr: z.number(),
  impressions: z.number(),
  top_campaigns: z.array(CampaignMetrics),
});
export type PlatformAds = z.infer<typeof PlatformAds>;

export const AdsMetrics = z.object({
  google_ads: PlatformAds,
  meta_ads: PlatformAds,
});
export type AdsMetrics = z.infer<typeof AdsMetrics>;

// ============================================================
// Hotjar Metrics
// ============================================================

export const HotjarMetrics = z.object({
  recordings_count: z.number(),
  avg_scroll_depth: z.number().optional(),
  rage_clicks: z.number().optional(),
  top_frustration_urls: z.array(z.string()).max(10).optional(),
});
export type HotjarMetrics = z.infer<typeof HotjarMetrics>;

// ============================================================
// DAILY SNAPSHOT — the main inter-agent artifact
// ============================================================

export const CollectionError = z.object({
  source: z.string(),
  error: z.string(),
  timestamp: ISODateTime,
});

export const DailySnapshotSchema = z.object({
  date: DateString,
  collected_at: ISODateTime,
  period: z.enum(['daily', 'weekly', 'monthly']),
  comparison_period: z.enum(['previous_day', 'previous_week', 'previous_month']),
  ga4: GA4Metrics,
  shopify: ShopifyMetrics,
  gsc: GSCMetrics,
  ads: AdsMetrics,
  hotjar: HotjarMetrics.optional(),
  collection_errors: z.array(CollectionError),
});
export type DailySnapshot = z.infer<typeof DailySnapshotSchema>;

// ============================================================
// ANALYSIS — Analyst agent output
// ============================================================

export const FunnelStage = z.enum([
  'awareness',
  'acquisition',
  'activation',
  'revenue',
  'retention',
  'referral',
]);

export const BiggestLeak = z.object({
  stage: FunnelStage,
  metric: z.string(),
  current_value: z.number(),
  baseline_value: z.number(),
  impact_estimate: z.string(),
  evidence: z.array(z.string()),
});

export const Anomaly = z.object({
  metric: z.string(),
  source: z.string(),
  value: z.number(),
  expected_range: z.object({ low: z.number(), high: z.number() }),
  severity: z.enum(['info', 'warning', 'critical']),
  possible_causes: z.array(z.string()),
});

export const Trend = z.object({
  metric: z.string(),
  direction: z.enum(['improving', 'declining', 'stable']),
  days_trending: z.number(),
  note: z.string(),
});

export const AnalysisSchema = z.object({
  date: DateString,
  snapshot_date: DateString,
  analyst_model: z.string(),
  summary: z.string(),
  biggest_leak: BiggestLeak,
  anomalies: z.array(Anomaly),
  trends: z.array(Trend),
  recommendations_for_hypothesis: z.array(z.string()),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

// ============================================================
// HYPOTHESIS — Hypothesis Generator output
// ============================================================

export const HypothesisStatus = z.enum([
  'proposed',
  'approved',
  'rejected',
  'implementing',
  'deployed',
  'verified',
]);

export const HypothesisSchema = z.object({
  id: z.string(),
  date: DateString,
  analysis_date: DateString,
  rank: z.number().min(1).max(5),
  title: z.string(),
  framework: z.enum(['PIE', 'ICE', 'PXL']),
  scores: z.object({
    potential: z.number().min(1).max(10),
    importance: z.number().min(1).max(10),
    ease: z.number().min(1).max(10),
    total: z.number(),
  }),
  hypothesis_statement: z.string(),
  change_description: z.string(),
  target_page: z.string(),
  target_metric: z.string(),
  expected_lift_pct: z.number(),
  implementation_type: z.enum([
    'liquid_template',
    'theme_setting',
    'meta_tag',
    'content',
    'structural',
  ]),
  risk_level: z.enum(['low', 'medium', 'high']),
  status: HypothesisStatus,
  approved_by: z.string().optional(),
  approved_at: ISODateTime.optional(),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const HypothesisBatchSchema = z.object({
  date: DateString,
  hypotheses: z.array(HypothesisSchema).min(1).max(5),
});
export type HypothesisBatch = z.infer<typeof HypothesisBatchSchema>;

// ============================================================
// EXPERIMENT LOG — tracks all experiments ever run
// ============================================================

export const VerificationResult = z.object({
  tested_at: ISODateTime,
  days_monitored: z.number(),
  sample_size: z.number(),
  statistical_significance: z.number(),
  confidence_level: z.number(),
  lift_pct: z.number(),
  recommendation: z.enum(['KEEP', 'REVERT', 'EXTEND_TEST']),
  reasoning: z.string(),
});

export const ExperimentSchema = z.object({
  id: z.string(),
  hypothesis_id: z.string(),
  status: z.enum([
    'pending',
    'deployed',
    'monitoring',
    'verified',
    'kept',
    'reverted',
  ]),
  deployed_at: ISODateTime.optional(),
  pr_url: z.string().url().optional(),
  pr_number: z.number().optional(),
  theme_branch: z.string().optional(),
  changes_summary: z.string(),
  baseline_metrics: z.record(z.string(), z.number()),
  current_metrics: z.record(z.string(), z.number()).optional(),
  verification: VerificationResult.optional(),
});
export type Experiment = z.infer<typeof ExperimentSchema>;

export const ExperimentLogSchema = z.object({
  experiments: z.array(ExperimentSchema),
  last_updated: ISODateTime,
});
export type ExperimentLog = z.infer<typeof ExperimentLogSchema>;

// ============================================================
// BASELINES — rolling averages for anomaly detection
// ============================================================

export const BaselineStat = z.object({
  mean: z.number(),
  stddev: z.number(),
});

export const BaselinesSchema = z.object({
  computed_at: ISODateTime,
  period_days: z.number(),
  metrics: z.object({
    daily_sessions: BaselineStat,
    conversion_rate: BaselineStat,
    aov: BaselineStat,
    daily_revenue: BaselineStat,
    bounce_rate: BaselineStat,
    cart_abandonment_rate: BaselineStat,
    google_ads_roas: BaselineStat,
    meta_ads_roas: BaselineStat,
    avg_position: BaselineStat,
    organic_ctr: BaselineStat,
  }),
});
export type Baselines = z.infer<typeof BaselinesSchema>;

// ============================================================
// AD WATCHDOG — alert output
// ============================================================

export const AdAlertLevel = z.enum(['OK', 'WARNING', 'CRITICAL']);

export const AdAlertSchema = z.object({
  date: DateString,
  overall_level: AdAlertLevel,
  alerts: z.array(
    z.object({
      platform: z.enum(['google_ads', 'meta_ads']),
      level: AdAlertLevel,
      campaign_id: z.string().optional(),
      campaign_name: z.string().optional(),
      metric: z.string(),
      value: z.number(),
      threshold: z.number(),
      consecutive_days: z.number(),
      recommended_action: z.string(),
    }),
  ),
});
export type AdAlert = z.infer<typeof AdAlertSchema>;

// ============================================================
// SEO REPORT — weekly SEO agent output
// ============================================================

export const KeywordOpportunity = z.object({
  query: z.string(),
  impressions: z.number(),
  clicks: z.number(),
  ctr: z.number(),
  position: z.number(),
  opportunity_type: z.enum(['strike_distance', 'low_ctr', 'content_gap']),
  recommended_action: z.string(),
});

export const SEOReportSchema = z.object({
  date: DateString,
  keyword_opportunities: z.array(KeywordOpportunity),
  meta_tag_updates: z.array(
    z.object({
      page: z.string(),
      current_title: z.string(),
      proposed_title: z.string(),
      current_description: z.string(),
      proposed_description: z.string(),
    }),
  ),
  content_recommendations: z.array(
    z.object({
      topic: z.string(),
      target_keywords: z.array(z.string()),
      search_volume_estimate: z.string(),
      content_type: z.enum(['blog_post', 'landing_page', 'faq']),
      outline: z.string(),
    }),
  ),
});
export type SEOReport = z.infer<typeof SEOReportSchema>;

// ============================================================
// DAILY DIGEST — Conductor output for Slack
// ============================================================

export const DailyDigestSchema = z.object({
  date: DateString,
  metrics_summary: z.object({
    sessions: MetricWithDelta,
    bounce_rate: MetricWithDelta,
    pdp_views: z.number(),
    add_to_cart: z.number(),
    atc_rate: z.number(),
    checkouts: z.number(),
    orders: z.number(),
    revenue: z.number(),
    roas_google: z.number(),
    roas_meta: z.number(),
  }),
  biggest_bottleneck: z.object({
    stage: z.string(),
    description: z.string(),
    visitors_lost: z.number(),
  }),
  top_hypothesis: z
    .object({
      id: z.string(),
      title: z.string(),
      expected_impact: z.string(),
      effort: z.string(),
      confidence: z.number(),
      status: HypothesisStatus,
    })
    .optional(),
  active_experiments: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      days_live: z.number(),
      status: z.string(),
    }),
  ),
  ad_alert: AdAlertLevel,
  ad_alert_details: z.string().optional(),
});
export type DailyDigest = z.infer<typeof DailyDigestSchema>;
