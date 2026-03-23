import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDates, getPath } from '../src/lib/file-store.js';

// ---------------------------------------------------------------------------
// Slack notification
// ---------------------------------------------------------------------------

/**
 * Send a formatted message to a Slack incoming webhook.
 * Accepts markdown-style text and posts it as a Slack mrkdwn block.
 */
export async function notifySlack(webhookUrl: string, text: string): Promise<void> {
  // Slack incoming webhooks accept a simple JSON payload.
  // We use blocks for richer formatting but also include `text` as fallback.
  const payload = {
    text, // fallback for notifications
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text,
        },
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack webhook failed (${response.status}): ${body}`);
  }
}

/**
 * Split a long message into Slack-compatible chunks (max ~3000 chars per block)
 * and send them sequentially.
 */
export async function notifySlackLong(webhookUrl: string, text: string): Promise<void> {
  const MAX_BLOCK_LENGTH = 3000;

  if (text.length <= MAX_BLOCK_LENGTH) {
    return notifySlack(webhookUrl, text);
  }

  // Split on double newlines to keep sections intact
  const sections = text.split(/\n\n/);
  let currentChunk = '';

  for (const section of sections) {
    if (currentChunk.length + section.length + 2 > MAX_BLOCK_LENGTH) {
      if (currentChunk.trim()) {
        await notifySlack(webhookUrl, currentChunk.trim());
      }
      currentChunk = section;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + section;
    }
  }

  if (currentChunk.trim()) {
    await notifySlack(webhookUrl, currentChunk.trim());
  }
}

// ---------------------------------------------------------------------------
// CLI entry point — reads the most recent digest and sends it
// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('SLACK_WEBHOOK_URL environment variable is required');
    process.exit(1);
  }

  // Look for the most recent daily digest
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(__dirname, '..', 'data');

  // Try to find digests (stored as data/digests/YYYY-MM-DD.json or similar)
  const digestDir = join(dataDir, 'digests');
  let digestText: string | null = null;

  if (existsSync(digestDir)) {
    const files = readdirSync(digestDir)
      .filter((f: string) => f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > 0) {
      const latest = JSON.parse(readFileSync(join(digestDir, files[0]), 'utf-8'));
      // Build a simple text summary from the digest object
      digestText = formatDigest(latest);
    }
  }

  // Fallback: look for analysis files
  if (!digestText) {
    const dates = listDates('analyses');
    if (dates.length > 0) {
      const analysisPath = getPath('analyses', dates[0]);
      const analysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
      digestText = `*Daily CRO Analysis — ${analysis.date}*\n\n${analysis.summary}`;
    }
  }

  if (!digestText) {
    console.error('No digest or analysis found to send');
    process.exit(1);
  }

  try {
    await notifySlackLong(webhookUrl, digestText);
    console.log('Slack notification sent successfully');
  } catch (err) {
    console.error('Failed to send Slack notification:', err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Digest formatter
// ---------------------------------------------------------------------------

function formatDigest(digest: any): string {
  const lines: string[] = [];

  lines.push(`*:chart_with_upwards_trend: Daily CRO Digest — ${digest.date}*`);
  lines.push('');

  if (digest.metrics_summary) {
    const m = digest.metrics_summary;
    lines.push('*Key Metrics:*');
    lines.push(`Sessions: ${m.sessions?.value?.toLocaleString() ?? 'N/A'} (${formatDelta(m.sessions?.delta_pct)})`);
    lines.push(`Bounce Rate: ${m.bounce_rate?.value?.toFixed(1) ?? 'N/A'}% (${formatDelta(m.bounce_rate?.delta_pct)})`);
    lines.push(`Orders: ${m.orders ?? 'N/A'} | Revenue: $${m.revenue?.toLocaleString() ?? 'N/A'}`);
    lines.push(`ROAS — Google: ${m.roas_google?.toFixed(2) ?? 'N/A'} | Meta: ${m.roas_meta?.toFixed(2) ?? 'N/A'}`);
    lines.push('');
  }

  if (digest.biggest_bottleneck) {
    const b = digest.biggest_bottleneck;
    lines.push(`*Biggest Bottleneck:* ${b.stage}`);
    lines.push(b.description);
    lines.push(`~${b.visitors_lost?.toLocaleString() ?? '?'} visitors lost`);
    lines.push('');
  }

  if (digest.top_hypothesis) {
    const h = digest.top_hypothesis;
    lines.push(`*Top Hypothesis:* ${h.title}`);
    lines.push(`Expected impact: ${h.expected_impact} | Status: ${h.status}`);
    lines.push('');
  }

  if (digest.active_experiments?.length) {
    lines.push(`*Active Experiments:* ${digest.active_experiments.length}`);
    for (const exp of digest.active_experiments) {
      lines.push(`  - ${exp.title} (${exp.days_live}d live, ${exp.status})`);
    }
    lines.push('');
  }

  if (digest.ad_alert && digest.ad_alert !== 'OK') {
    lines.push(`*:warning: Ad Alert:* ${digest.ad_alert}`);
    if (digest.ad_alert_details) {
      lines.push(digest.ad_alert_details);
    }
  }

  return lines.join('\n');
}

function formatDelta(pct: number | undefined): string {
  if (pct === undefined || pct === null) return 'N/A';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
