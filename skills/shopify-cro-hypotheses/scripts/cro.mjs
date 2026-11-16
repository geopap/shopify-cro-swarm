#!/usr/bin/env node
// Shopify CRO hypotheses: funnel leak finder and test planner.
// Zero dependencies, no network access. Reads an aggregate funnel export and prints JSON.
//
//   node cro.mjs funnel <file.csv|file.json> [--min 200]
//   node cro.mjs plan --baseline 0.025 --mde 0.10 --daily 1500 [--alpha 0.05] [--power 0.8]

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const STAGES = ['sessions', 'product_views', 'add_to_cart', 'checkout', 'purchases'];
const LABEL = {
  sessions: 'Session', product_views: 'Product view', add_to_cart: 'Add to cart',
  checkout: 'Checkout started', purchases: 'Purchase',
};

// ---------- statistics ----------
export function normCdf(z) {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function normInv(p) {
  let lo = -10, hi = 10;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (normCdf(mid) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function twoProportion(x1, n1, x2, n2) {
  const p1 = x1 / n1, p2 = x2 / n2, p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  const z = se === 0 ? 0 : (p2 - p1) / se;
  return { p1, p2, z, pValue: 2 * (1 - normCdf(Math.abs(z))) };
}

/** Visitors per variant for a two-sided two-proportion test with a relative minimum detectable effect. */
export function sampleSize(baseline, relMde, alpha = 0.05, power = 0.8) {
  if (!(baseline > 0 && baseline < 1)) throw new Error('baseline must be a rate between 0 and 1, e.g. 0.025');
  if (!(relMde > 0)) throw new Error('mde must be a relative lift above 0, e.g. 0.10 for +10%');
  const p2 = baseline * (1 + relMde);
  if (p2 >= 1) throw new Error('baseline × (1 + mde) must stay below 1');
  const za = normInv(1 - alpha / 2), zb = normInv(power), pbar = (baseline + p2) / 2;
  const n = (za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(baseline * (1 - baseline) + p2 * (1 - p2))) ** 2 / (p2 - baseline) ** 2;
  return Math.ceil(n);
}

export function plan({ baseline, mde, daily, alpha = 0.05, power = 0.8 }) {
  const perVariant = sampleSize(baseline, mde, alpha, power);
  if (!(daily > 0)) throw new Error('daily must be the number of eligible visitors per day, above 0');
  const rawDays = Math.ceil((2 * perVariant) / daily);
  const days = Math.max(14, Math.ceil(rawDays / 7) * 7); // full weeks, at least two weekly cycles
  return {
    baseline, mde, alpha, power, daily,
    per_variant: perVariant,
    total: 2 * perVariant,
    days,
    feasible: days <= 42,
    note: days <= 42
      ? `Run ${days} days (full weeks) even if the result looks clear earlier. Decide only at the planned end.`
      : `Needs ${days} days: not practical. Test a bolder change (larger effect), a higher-traffic page, or a metric closer to the change.`,
  };
}

// ---------- input ----------
export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row');
  const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((l) => {
    const cells = l.split(sep);
    return Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });
}

export function normalise(rows) {
  const list = Array.isArray(rows) ? rows : rows.segments ?? rows.rows ?? [rows];
  return list.map((r, i) => {
    const out = { segment: String(r.segment ?? r.device ?? r.channel ?? `segment ${i + 1}`) };
    for (const s of STAGES) {
      const v = Number(String(r[s] ?? '').replace(/[\s']/g, ''));
      if (!Number.isFinite(v) || v < 0) throw new Error(`"${out.segment}": ${s} must be a non-negative number`);
      out[s] = v;
    }
    for (let k = 1; k < STAGES.length; k++) {
      if (out[STAGES[k]] > out[STAGES[k - 1]]) {
        throw new Error(`"${out.segment}": ${STAGES[k]} (${out[STAGES[k]]}) is larger than ${STAGES[k - 1]} (${out[STAGES[k - 1]]}). Stages must be in funnel order and from the same period.`);
      }
    }
    const rev = Number(String(r.revenue ?? '').replace(/[\s']/g, ''));
    out.revenue = Number.isFinite(rev) && rev > 0 ? rev : null;
    return out;
  });
}

export function load(file) {
  const text = readFileSync(file, 'utf8');
  return normalise(file.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text));
}

// ---------- funnel analysis ----------
const rate = (seg, k) => (seg[STAGES[k - 1]] > 0 ? seg[STAGES[k]] / seg[STAGES[k - 1]] : 0);

/**
 * For every step, compare each segment with the best-performing segment that has enough volume.
 * Lost orders = visitors reaching the step × rate gap × the segment's own conversion after the step.
 */
export function funnel(segments, { min = 200 } = {}) {
  const steps = [];
  for (let k = 1; k < STAGES.length; k++) {
    const eligible = segments.filter((s) => s[STAGES[k - 1]] >= min);
    const best = eligible.reduce((b, s) => (!b || rate(s, k) > rate(b, k) ? s : b), null);
    for (const s of segments) {
      const n = s[STAGES[k - 1]];
      const r = rate(s, k);
      let downstream = 1;
      for (let j = k + 1; j < STAGES.length; j++) downstream *= rate(s, j);
      const row = {
        step: `${LABEL[STAGES[k - 1]]} → ${LABEL[STAGES[k]]}`,
        from: STAGES[k - 1], to: STAGES[k],
        segment: s.segment, reached: n, rate: round(r, 4),
        best_segment: best?.segment ?? null, best_rate: best ? round(rate(best, k), 4) : null,
        lost_orders: 0, lost_revenue: null, significant: false, p_value: null,
        enough_data: n >= min,
      };
      if (best && best !== s && n >= min && rate(best, k) > r) {
        const t = twoProportion(s[STAGES[k]], n, best[STAGES[k]], best[STAGES[k - 1]]);
        row.p_value = round(t.pValue, 4);
        row.significant = t.pValue < 0.05;
        row.lost_orders = round(n * (rate(best, k) - r) * downstream, 1);
        const aov = s.revenue && s.purchases ? s.revenue / s.purchases : null;
        row.lost_revenue = aov ? Math.round(row.lost_orders * aov) : null;
      }
      steps.push(row);
    }
  }
  const leaks = steps.filter((x) => x.lost_orders > 0).sort((a, b) => b.lost_orders - a.lost_orders);
  const total = sumBy(segments);
  return {
    segments: segments.map((s) => ({
      segment: s.segment,
      conversion: round(s.purchases / s.sessions, 4),
      aov: s.revenue && s.purchases ? round(s.revenue / s.purchases, 2) : null,
      steps: STAGES.slice(1).map((st, i) => ({ to: st, rate: round(rate(s, i + 1), 4) })),
    })),
    total: { ...total, conversion: round(total.purchases / total.sessions, 4) },
    biggest_leak: leaks[0] ?? null,
    leaks: leaks.slice(0, 5),
    warnings: [
      ...(segments.length < 2 ? ['Only one segment: the gap to a better segment cannot be measured. Export the same funnel by device or channel.'] : []),
      ...segments.filter((s) => s.sessions < min).map((s) => `"${s.segment}" has fewer than ${min} sessions; its rates are noisy and it is not used as a benchmark.`),
      ...(leaks[0] && !leaks[0].significant ? ['The largest gap is not statistically significant. Treat it as a lead, not a finding.'] : []),
    ],
  };
}

function sumBy(segments) {
  const t = {};
  for (const s of STAGES) t[s] = segments.reduce((a, x) => a + x[s], 0);
  return t;
}
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

// ---------- CLI ----------
function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
    else o._.push(argv[i]);
  }
  return o;
}

function main(argv) {
  const a = args(argv);
  const [cmd, file] = a._;
  if (cmd === 'funnel' && file) return funnel(load(file), { min: a.min ? Number(a.min) : 200 });
  if (cmd === 'plan') {
    return plan({
      baseline: Number(a.baseline), mde: Number(a.mde), daily: Number(a.daily),
      alpha: a.alpha ? Number(a.alpha) : 0.05, power: a.power ? Number(a.power) : 0.8,
    });
  }
  throw new Error('Usage:\n  node cro.mjs funnel <export.csv|export.json> [--min 200]\n  node cro.mjs plan --baseline 0.025 --mde 0.10 --daily 1500');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    console.log(JSON.stringify(main(process.argv.slice(2)), null, 2));
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}
