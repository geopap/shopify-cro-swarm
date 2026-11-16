import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { sampleSize, plan, funnel, load, normalise, parseCsv, twoProportion, normInv } from './cro.mjs';

const sample = fileURLToPath(new URL('../examples/sample-funnel.csv', import.meta.url));

describe('statistics', () => {
  it('inverts the normal distribution', () => {
    expect(normInv(0.975)).toBeCloseTo(1.96, 2);
    expect(normInv(0.8)).toBeCloseTo(0.8416, 3);
  });

  it('matches standard sample-size calculators', () => {
    // 10.8% baseline, +10% relative, α 0.05 two-sided, power 80% → about 13,500 per variant
    expect(sampleSize(0.108, 0.1)).toBeGreaterThan(13300);
    expect(sampleSize(0.108, 0.1)).toBeLessThan(13700);
    // smaller effects need more traffic
    expect(sampleSize(0.108, 0.05)).toBeGreaterThan(3.5 * sampleSize(0.108, 0.1));
  });

  it('two-proportion test detects a clear gap and ignores a tiny one', () => {
    expect(twoProportion(100, 1000, 160, 1000).pValue).toBeLessThan(0.001);
    expect(twoProportion(100, 1000, 102, 1000).pValue).toBeGreaterThan(0.5);
  });

  it('rejects impossible inputs', () => {
    expect(() => sampleSize(2, 0.1)).toThrow(/between 0 and 1/);
    expect(() => sampleSize(0.1, 0)).toThrow(/above 0/);
    expect(() => plan({ baseline: 0.1, mde: 0.1, daily: 0 })).toThrow(/daily/);
  });
});

describe('test plan', () => {
  it('runs full weeks, at least two', () => {
    const p = plan({ baseline: 0.108, mde: 0.1, daily: 1600 });
    expect(p.days % 7).toBe(0);
    expect(p.days).toBe(21);
    expect(p.feasible).toBe(true);
    expect(plan({ baseline: 0.3, mde: 0.3, daily: 100000 }).days).toBe(14);
  });

  it('says plainly when a test is not feasible', () => {
    const p = plan({ baseline: 0.014, mde: 0.05, daily: 300 });
    expect(p.feasible).toBe(false);
    expect(p.note).toMatch(/not practical/);
  });
});

describe('funnel', () => {
  it('finds the biggest leak and sizes it from the segment’s own downstream rates', () => {
    const r = funnel(load(sample));
    expect(r.biggest_leak.segment).toBe('mobile');
    expect(r.biggest_leak.from).toBe('product_views');
    expect(r.biggest_leak.best_segment).toBe('desktop');
    // 49,200 × (3420/21400 − 5310/49200) × (2870/5310) × (1350/2870)
    const expected = 49200 * (3420 / 21400 - 5310 / 49200) * (2870 / 5310) * (1350 / 2870);
    expect(r.biggest_leak.lost_orders).toBeCloseTo(expected, 0);
    expect(r.biggest_leak.significant).toBe(true);
    expect(r.biggest_leak.lost_revenue).toBeGreaterThan(0);
    expect(r.total.purchases).toBe(2752);
  });

  it('never uses a low-volume segment as the benchmark', () => {
    const r = funnel(normalise([
      { segment: 'big', sessions: 10000, product_views: 5000, add_to_cart: 500, checkout: 250, purchases: 120 },
      { segment: 'tiny', sessions: 50, product_views: 40, add_to_cart: 30, checkout: 20, purchases: 15 },
    ]));
    expect(r.leaks.every((l) => l.best_segment === 'big' || l.best_segment === null)).toBe(true);
    expect(r.warnings.some((w) => w.includes('"tiny"'))).toBe(true);
  });

  it('warns when there is only one segment', () => {
    const r = funnel(normalise([{ sessions: 1000, product_views: 500, add_to_cart: 50, checkout: 30, purchases: 20 }]));
    expect(r.biggest_leak).toBeNull();
    expect(r.warnings[0]).toMatch(/Only one segment/);
  });
});

describe('input', () => {
  it('reads semicolon CSV, a BOM and spaced headers', () => {
    const rows = parseCsv('﻿Segment;Sessions;Product views;Add to cart;Checkout;Purchases\nmobile;1000;500;50;30;20');
    expect(normalise(rows)[0]).toMatchObject({ segment: 'mobile', sessions: 1000, purchases: 20 });
  });

  it('rejects stages out of funnel order', () => {
    expect(() => normalise([{ segment: 'x', sessions: 100, product_views: 200, add_to_cart: 1, checkout: 1, purchases: 1 }]))
      .toThrow(/funnel order/);
  });

  it('rejects text where a number is expected', () => {
    expect(() => normalise([{ segment: 'x', sessions: 'lots', product_views: 1, add_to_cart: 1, checkout: 1, purchases: 1 }]))
      .toThrow(/non-negative number/);
  });
});
