import { z } from 'zod/v4';

const EnvSchema = z.object({
  // GA4
  GA4_SERVICE_ACCOUNT_KEY: z.string().min(1),
  GA4_PROPERTY_ID: z.string().min(1),

  // Google Search Console
  GSC_SITE_URL: z.string().url(),

  // Shopify
  SHOPIFY_STORE_URL: z.string().min(1),
  SHOPIFY_ACCESS_TOKEN: z.string().min(1),

  // Google Ads
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().min(1),
  GOOGLE_ADS_CLIENT_ID: z.string().min(1),
  GOOGLE_ADS_CLIENT_SECRET: z.string().min(1),
  GOOGLE_ADS_REFRESH_TOKEN: z.string().min(1),
  GOOGLE_ADS_CUSTOMER_ID: z.string().min(1),

  // Meta Ads
  META_ACCESS_TOKEN: z.string().min(1),
  META_AD_ACCOUNT_ID: z.string().min(1),

  // Hotjar (optional — requires Business plan)
  HOTJAR_API_KEY: z.string().optional(),
  HOTJAR_SITE_ID: z.string().optional(),

  // Slack
  SLACK_WEBHOOK_URL: z.string().url(),

  // GitHub (for Implementer)
  GITHUB_THEME_REPO: z.string().min(1),
  GITHUB_THEME_TOKEN: z.string().min(1),
});

export type Config = z.infer<typeof EnvSchema>;

/**
 * Load and validate all environment variables.
 * Throws with a clear error listing missing/invalid vars.
 */
export function loadConfig(): Config {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    console.error('Missing or invalid environment variables:\n', formatted);
    process.exit(1);
  }
  return result.data as Config;
}

/**
 * Load only the subset of config needed for data collection.
 * More lenient — allows partial collection when some APIs are not configured.
 */
export function loadCollectorConfig(): Partial<Config> {
  const partial: Partial<Config> = {};
  const env = process.env;

  if (env.GA4_SERVICE_ACCOUNT_KEY && env.GA4_PROPERTY_ID) {
    partial.GA4_SERVICE_ACCOUNT_KEY = env.GA4_SERVICE_ACCOUNT_KEY;
    partial.GA4_PROPERTY_ID = env.GA4_PROPERTY_ID;
  }

  if (env.GSC_SITE_URL) {
    partial.GSC_SITE_URL = env.GSC_SITE_URL;
  }

  if (env.SHOPIFY_STORE_URL && env.SHOPIFY_ACCESS_TOKEN) {
    partial.SHOPIFY_STORE_URL = env.SHOPIFY_STORE_URL;
    partial.SHOPIFY_ACCESS_TOKEN = env.SHOPIFY_ACCESS_TOKEN;
  }

  if (
    env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    env.GOOGLE_ADS_CLIENT_ID &&
    env.GOOGLE_ADS_CLIENT_SECRET &&
    env.GOOGLE_ADS_REFRESH_TOKEN &&
    env.GOOGLE_ADS_CUSTOMER_ID
  ) {
    partial.GOOGLE_ADS_DEVELOPER_TOKEN = env.GOOGLE_ADS_DEVELOPER_TOKEN;
    partial.GOOGLE_ADS_CLIENT_ID = env.GOOGLE_ADS_CLIENT_ID;
    partial.GOOGLE_ADS_CLIENT_SECRET = env.GOOGLE_ADS_CLIENT_SECRET;
    partial.GOOGLE_ADS_REFRESH_TOKEN = env.GOOGLE_ADS_REFRESH_TOKEN;
    partial.GOOGLE_ADS_CUSTOMER_ID = env.GOOGLE_ADS_CUSTOMER_ID;
  }

  if (env.META_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID) {
    partial.META_ACCESS_TOKEN = env.META_ACCESS_TOKEN;
    partial.META_AD_ACCOUNT_ID = env.META_AD_ACCOUNT_ID;
  }

  if (env.HOTJAR_API_KEY && env.HOTJAR_SITE_ID) {
    partial.HOTJAR_API_KEY = env.HOTJAR_API_KEY;
    partial.HOTJAR_SITE_ID = env.HOTJAR_SITE_ID;
  }

  if (env.SLACK_WEBHOOK_URL) {
    partial.SLACK_WEBHOOK_URL = env.SLACK_WEBHOOK_URL;
  }

  if (env.GITHUB_THEME_REPO && env.GITHUB_THEME_TOKEN) {
    partial.GITHUB_THEME_REPO = env.GITHUB_THEME_REPO;
    partial.GITHUB_THEME_TOKEN = env.GITHUB_THEME_TOKEN;
  }

  return partial;
}
