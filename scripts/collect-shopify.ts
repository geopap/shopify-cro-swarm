import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import type { Config } from '../src/lib/config.js';
import type { ShopifyMetrics, MetricWithDelta } from '../src/types/schemas.js';
import { yesterday, daysAgo } from '../src/lib/date-utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delta(current: number, previous: number): MetricWithDelta {
  const delta_pct = previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / Math.abs(previous)) * 100;
  return { value: current, previous, delta_pct: Math.round(delta_pct * 100) / 100 };
}

function buildClient(config: Partial<Config>) {
  const storeUrl = config.SHOPIFY_STORE_URL!;
  const hostName = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const shopify = shopifyApi({
    apiKey: 'shopify-app',
    apiSecretKey: 'shopify-app-secret',
    scopes: [],
    hostName,
    apiVersion: ApiVersion.January26,
    isEmbeddedApp: false,
    isCustomStoreApp: true,
    adminApiAccessToken: config.SHOPIFY_ACCESS_TOKEN!,
  });

  const session = shopify.session.customAppSession(hostName);
  const client = new shopify.clients.Graphql({ session });
  return client;
}

// ---------------------------------------------------------------------------
// GraphQL queries
// ---------------------------------------------------------------------------

const ORDERS_QUERY = `
query OrdersSummary($query: String!) {
  orders(first: 250, query: $query) {
    edges {
      node {
        id
        totalPriceSet { shopMoney { amount } }
        customer { numberOfOrders }
        lineItems(first: 50) {
          edges {
            node {
              product { id title }
              quantity
              originalTotalSet { shopMoney { amount } }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage }
  }
}`;

const ABANDONED_CHECKOUTS_QUERY = `
query AbandonedCheckouts($query: String!) {
  abandonedCheckouts(first: 250, query: $query) {
    edges {
      node { id }
    }
    pageInfo { hasNextPage }
  }
}`;

const INVENTORY_QUERY = `
query LowInventory {
  productVariants(first: 100, query: "inventory_quantity:<10 AND inventory_quantity:>0") {
    edges {
      node {
        id
        inventoryQuantity
        product { id title }
      }
    }
  }
}`;

// ---------------------------------------------------------------------------
// Main collector
// ---------------------------------------------------------------------------

export async function collectShopify(config: Partial<Config>): Promise<ShopifyMetrics> {
  if (!config.SHOPIFY_STORE_URL || !config.SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Shopify config missing: SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN are required');
  }

  const client = buildClient(config);
  const dateToday = yesterday();
  const datePrev = daysAgo(2);

  // ---- 1. Fetch orders for today and previous day ----
  const [todayOrdersRes, prevOrdersRes] = await Promise.all([
    client.request(ORDERS_QUERY, {
      variables: { query: `created_at:${dateToday}` },
    }),
    client.request(ORDERS_QUERY, {
      variables: { query: `created_at:${datePrev}` },
    }),
  ]);

  const todayOrders = (todayOrdersRes as any).data?.orders?.edges ?? [];
  const prevOrders = (prevOrdersRes as any).data?.orders?.edges ?? [];

  // Order counts
  const orderCountToday = todayOrders.length;
  const orderCountPrev = prevOrders.length;

  // Revenue
  const revenueToday = todayOrders.reduce(
    (sum: number, edge: any) => sum + parseFloat(edge.node.totalPriceSet?.shopMoney?.amount ?? '0'),
    0,
  );
  const revenuePrev = prevOrders.reduce(
    (sum: number, edge: any) => sum + parseFloat(edge.node.totalPriceSet?.shopMoney?.amount ?? '0'),
    0,
  );

  // AOV
  const aovToday = orderCountToday > 0 ? revenueToday / orderCountToday : 0;
  const aovPrev = orderCountPrev > 0 ? revenuePrev / orderCountPrev : 0;

  // Returning customer rate
  const returningToday = todayOrders.filter(
    (edge: any) => parseInt(edge.node.customer?.numberOfOrders ?? '0', 10) > 1,
  ).length;
  const returningPrev = prevOrders.filter(
    (edge: any) => parseInt(edge.node.customer?.numberOfOrders ?? '0', 10) > 1,
  ).length;
  const retRateToday = orderCountToday > 0 ? (returningToday / orderCountToday) * 100 : 0;
  const retRatePrev = orderCountPrev > 0 ? (returningPrev / orderCountPrev) * 100 : 0;

  // Top products by revenue
  const productMap = new Map<string, { product_id: string; title: string; units_sold: number; revenue: number }>();
  for (const edge of todayOrders) {
    for (const lineEdge of edge.node.lineItems?.edges ?? []) {
      const li = lineEdge.node;
      const productId = li.product?.id ?? 'unknown';
      const title = li.product?.title ?? 'Unknown';
      const existing = productMap.get(productId) ?? { product_id: productId, title, units_sold: 0, revenue: 0 };
      existing.units_sold += li.quantity ?? 0;
      existing.revenue += parseFloat(li.originalTotalSet?.shopMoney?.amount ?? '0');
      productMap.set(productId, existing);
    }
  }
  const top_products = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)
    .map((p) => ({
      ...p,
      conversion_rate: 0, // Would need GA4 product view data to compute accurately
    }));

  // ---- 2. Abandoned checkouts ----
  const [todayAbandoned, prevAbandoned] = await Promise.all([
    client.request(ABANDONED_CHECKOUTS_QUERY, {
      variables: { query: `created_at:${dateToday}` },
    }).catch(() => ({ data: { abandonedCheckouts: { edges: [] } } })),
    client.request(ABANDONED_CHECKOUTS_QUERY, {
      variables: { query: `created_at:${datePrev}` },
    }).catch(() => ({ data: { abandonedCheckouts: { edges: [] } } })),
  ]);

  const abandonedToday = (todayAbandoned as any).data?.abandonedCheckouts?.edges?.length ?? 0;
  const abandonedPrev = (prevAbandoned as any).data?.abandonedCheckouts?.edges?.length ?? 0;

  const totalCheckoutsToday = orderCountToday + abandonedToday;
  const totalCheckoutsPrev = orderCountPrev + abandonedPrev;
  const cartAbRateToday = totalCheckoutsToday > 0 ? (abandonedToday / totalCheckoutsToday) * 100 : 0;
  const cartAbRatePrev = totalCheckoutsPrev > 0 ? (abandonedPrev / totalCheckoutsPrev) * 100 : 0;

  // ---- 3. Inventory alerts ----
  let inventory_alerts: Array<{ product_id: string; title: string; inventory_quantity: number }> = [];
  try {
    const inventoryRes = await client.request(INVENTORY_QUERY);
    const variants = (inventoryRes as any).data?.productVariants?.edges ?? [];
    const seen = new Set<string>();
    for (const edge of variants) {
      const v = edge.node;
      const productId = v.product?.id ?? v.id;
      if (seen.has(productId)) continue;
      seen.add(productId);
      inventory_alerts.push({
        product_id: productId,
        title: v.product?.title ?? 'Unknown',
        inventory_quantity: v.inventoryQuantity ?? 0,
      });
    }
  } catch (err) {
    console.warn('Failed to fetch inventory alerts:', err);
  }

  return {
    orders: delta(orderCountToday, orderCountPrev),
    aov: delta(aovToday, aovPrev),
    cart_abandonment_rate: delta(cartAbRateToday, cartAbRatePrev),
    returning_customer_rate: delta(retRateToday, retRatePrev),
    top_products,
    inventory_alerts,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadCollectorConfig } = await import('../src/lib/config.js');
  const config = loadCollectorConfig();
  try {
    const result = await collectShopify(config);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Shopify collection failed:', err);
    process.exit(1);
  }
}
