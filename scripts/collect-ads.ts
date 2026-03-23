import { google } from 'googleapis';
import bizSdk from 'facebook-nodejs-business-sdk';
import type { Config } from '../src/lib/config.js';
import type { PlatformAds } from '../src/types/index.js';
import { yesterday, daysAgo } from '../src/lib/date-utils.js';

const { FacebookAdsApi, AdAccount } = bizSdk;

// ---------------------------------------------------------------------------
// Google Ads collector
// ---------------------------------------------------------------------------

export async function collectGoogleAds(config: Partial<Config>): Promise<PlatformAds> {
  if (
    !config.GOOGLE_ADS_DEVELOPER_TOKEN ||
    !config.GOOGLE_ADS_CLIENT_ID ||
    !config.GOOGLE_ADS_CLIENT_SECRET ||
    !config.GOOGLE_ADS_REFRESH_TOKEN ||
    !config.GOOGLE_ADS_CUSTOMER_ID
  ) {
    throw new Error('Google Ads config missing');
  }

  const oauth2Client = new google.auth.OAuth2(
    config.GOOGLE_ADS_CLIENT_ID,
    config.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: config.GOOGLE_ADS_REFRESH_TOKEN });

  const customerId = config.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');
  const dateToday = yesterday().replace(/-/g, '');

  // Use the Google Ads REST API via fetch
  const tokenInfo = await oauth2Client.getAccessToken();
  const accessToken = tokenInfo.token;

  const gaqlQuery = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.clicks,
      metrics.impressions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date = '${dateToday}'
      AND campaign.status = 'ENABLED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;

  const url = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': config.GOOGLE_ADS_DEVELOPER_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: gaqlQuery }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Ads API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const results = (data as any[])?.[0]?.results ?? [];

  let totalSpend = 0;
  let totalConversions = 0;
  let totalConversionsValue = 0;
  let totalClicks = 0;
  let totalImpressions = 0;

  const top_campaigns = results.slice(0, 20).map((row: any) => {
    const costMicros = parseFloat(row.metrics?.costMicros ?? '0');
    const spend = costMicros / 1_000_000;
    const conversions = parseFloat(row.metrics?.conversions ?? '0');
    const conversionsValue = parseFloat(row.metrics?.conversionsValue ?? '0');
    const clicks = parseInt(row.metrics?.clicks ?? '0', 10);
    const impressions = parseInt(row.metrics?.impressions ?? '0', 10);

    totalSpend += spend;
    totalConversions += conversions;
    totalConversionsValue += conversionsValue;
    totalClicks += clicks;
    totalImpressions += impressions;

    return {
      campaign_id: row.campaign?.id ?? '',
      name: row.campaign?.name ?? '',
      spend,
      conversions,
      roas: spend > 0 ? conversionsValue / spend : 0,
    };
  });

  // Also add remaining rows to totals (beyond top 20)
  for (const row of results.slice(20)) {
    const costMicros = parseFloat(row.metrics?.costMicros ?? '0');
    totalSpend += costMicros / 1_000_000;
    totalConversions += parseFloat(row.metrics?.conversions ?? '0');
    totalConversionsValue += parseFloat(row.metrics?.conversionsValue ?? '0');
    totalClicks += parseInt(row.metrics?.clicks ?? '0', 10);
    totalImpressions += parseInt(row.metrics?.impressions ?? '0', 10);
  }

  return {
    spend: totalSpend,
    conversions: totalConversions,
    roas: totalSpend > 0 ? totalConversionsValue / totalSpend : 0,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    impressions: totalImpressions,
    top_campaigns,
  };
}

// ---------------------------------------------------------------------------
// Meta Ads collector
// ---------------------------------------------------------------------------

export async function collectMetaAds(config: Partial<Config>): Promise<PlatformAds> {
  if (!config.META_ACCESS_TOKEN || !config.META_AD_ACCOUNT_ID) {
    throw new Error('Meta Ads config missing: META_ACCESS_TOKEN and META_AD_ACCOUNT_ID are required');
  }

  FacebookAdsApi.init(config.META_ACCESS_TOKEN);
  const accountId = config.META_AD_ACCOUNT_ID.startsWith('act_')
    ? config.META_AD_ACCOUNT_ID
    : `act_${config.META_AD_ACCOUNT_ID}`;

  const account = new AdAccount(accountId);
  const dateToday = yesterday();

  // Fetch account-level insights
  const insights = await account.getInsights(
    [
      'spend',
      'actions',
      'action_values',
      'clicks',
      'impressions',
      'cpc',
      'ctr',
    ],
    {
      time_range: { since: dateToday, until: dateToday },
      level: 'account',
    },
  );

  const accountData = insights?.[0]?._data ?? {};
  const spend = parseFloat(accountData.spend ?? '0');
  const clicks = parseInt(accountData.clicks ?? '0', 10);
  const impressions = parseInt(accountData.impressions ?? '0', 10);
  const cpc = parseFloat(accountData.cpc ?? '0');
  const ctr = parseFloat(accountData.ctr ?? '0');

  // Extract conversions from actions
  const actions: Array<{ action_type: string; value: string }> = accountData.actions ?? [];
  const purchaseAction = actions.find((a) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
  const conversions = purchaseAction ? parseFloat(purchaseAction.value) : 0;

  // Extract conversion value
  const actionValues: Array<{ action_type: string; value: string }> = accountData.action_values ?? [];
  const purchaseValue = actionValues.find((a) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
  const conversionValue = purchaseValue ? parseFloat(purchaseValue.value) : 0;

  const roas = spend > 0 ? conversionValue / spend : 0;

  // Fetch campaign-level insights for top campaigns
  const campaignInsights = await account.getInsights(
    ['campaign_id', 'campaign_name', 'spend', 'actions', 'action_values'],
    {
      time_range: { since: dateToday, until: dateToday },
      level: 'campaign',
      sort: ['spend_descending'],
      limit: 20,
    },
  );

  const top_campaigns = (campaignInsights ?? []).map((row: any) => {
    const d = row._data ?? {};
    const campSpend = parseFloat(d.spend ?? '0');
    const campActions: Array<{ action_type: string; value: string }> = d.actions ?? [];
    const campPurchase = campActions.find(
      (a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase',
    );
    const campConversions = campPurchase ? parseFloat(campPurchase.value) : 0;
    const campActionValues: Array<{ action_type: string; value: string }> = d.action_values ?? [];
    const campPurchaseVal = campActionValues.find(
      (a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase',
    );
    const campConversionValue = campPurchaseVal ? parseFloat(campPurchaseVal.value) : 0;

    return {
      campaign_id: d.campaign_id ?? '',
      name: d.campaign_name ?? '',
      spend: campSpend,
      conversions: campConversions,
      roas: campSpend > 0 ? campConversionValue / campSpend : 0,
    };
  });

  return {
    spend,
    conversions,
    roas,
    cpc,
    ctr,
    impressions,
    top_campaigns,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadCollectorConfig } = await import('../src/lib/config.js');
  const config = loadCollectorConfig();

  const results: Record<string, any> = {};
  const errors: string[] = [];

  await Promise.allSettled([
    collectGoogleAds(config).then((r) => { results.google_ads = r; }),
    collectMetaAds(config).then((r) => { results.meta_ads = r; }),
  ]).then((outcomes) => {
    outcomes.forEach((outcome, i) => {
      if (outcome.status === 'rejected') {
        const label = i === 0 ? 'Google Ads' : 'Meta Ads';
        errors.push(`${label}: ${outcome.reason}`);
      }
    });
  });

  if (errors.length) {
    console.error('Ads collection errors:', errors);
  }
  console.log(JSON.stringify(results, null, 2));
  if (errors.length && !Object.keys(results).length) process.exit(1);
}
