#!/usr/bin/env node
/**
 * build-dashboard.ts
 *
 * Reads up to 90 days of daily snapshots + latest reports from each agent,
 * then generates a self-contained dashboard/index.html with all data inlined.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { today, nowISO } from '../src/lib/date-utils.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data');
const OUT_DIR = join(ROOT, 'dashboard');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeReadJSON(filePath: string): unknown | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function listJSONFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
}

function latestFile(dir: string): unknown | null {
  const files = listJSONFiles(dir);
  if (files.length === 0) return null;
  return safeReadJSON(join(dir, files[0]));
}

function readDirFiles(dir: string, maxFiles: number): unknown[] {
  const files = listJSONFiles(dir).slice(0, maxFiles);
  const results: unknown[] = [];
  for (const f of files) {
    const data = safeReadJSON(join(dir, f));
    if (data) results.push(data);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Collect data
// ---------------------------------------------------------------------------

console.log('📊 Building dashboard…');

const snapshots = readDirFiles(join(DATA_DIR, 'snapshots'), 90);
const latestAnalysis = latestFile(join(DATA_DIR, 'analyses'));
const latestHypotheses = latestFile(join(DATA_DIR, 'hypotheses'));
const latestInventory = latestFile(join(DATA_DIR, 'inventory-reports'));
const latestSpeed = latestFile(join(DATA_DIR, 'speed-reports'));
const latestCartRecovery = latestFile(join(DATA_DIR, 'cart-recovery-reports'));
const latestSEO = latestFile(join(DATA_DIR, 'seo-reports'));
const experimentLog = safeReadJSON(join(DATA_DIR, 'experiment-log.json'));
const baselines = safeReadJSON(join(DATA_DIR, 'baselines.json'));

// Also try to read a manifest for store name
const manifest = safeReadJSON(join(ROOT, 'manifest.json')) as Record<string, unknown> | null;
const storeName = (manifest?.store_name as string) ?? 'Shopify CRO Dashboard';

const dashboardData = {
  storeName,
  generatedAt: nowISO(),
  todayStr: today(),
  snapshots,
  latestAnalysis,
  latestHypotheses,
  latestInventory,
  latestSpeed,
  latestCartRecovery,
  latestSEO,
  experimentLog,
  baselines,
};

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${storeName}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
/* ======== CSS VARIABLES / THEME ======== */
:root {
  --bg: #f5f6fa;
  --surface: #ffffff;
  --text: #1a1a2e;
  --text-secondary: #6b7280;
  --border: #e5e7eb;
  --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --radius: 10px;
  --radius-sm: 6px;
  --green: #059669;
  --green-bg: #ecfdf5;
  --red: #dc2626;
  --red-bg: #fef2f2;
  --blue: #2563eb;
  --blue-bg: #eff6ff;
  --yellow: #d97706;
  --yellow-bg: #fffbeb;
  --gold: #b45309;
  --purple: #7c3aed;
  --accent: #2563eb;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
[data-theme="dark"] {
  --bg: #0f172a;
  --surface: #1e293b;
  --text: #e2e8f0;
  --text-secondary: #94a3b8;
  --border: #334155;
  --shadow: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.3);
  --green-bg: #064e3b;
  --red-bg: #450a0a;
  --blue-bg: #1e3a5f;
  --yellow-bg: #451a03;
}

/* ======== RESET & BASE ======== */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.5;transition:background .2s,color .2s}
a{color:var(--accent);text-decoration:none}

/* ======== LAYOUT ======== */
.container{max-width:1400px;margin:0 auto;padding:0 20px 40px}

/* ======== HEADER ======== */
.header{background:var(--surface);border-bottom:1px solid var(--border);padding:16px 0;position:sticky;top:0;z-index:50;box-shadow:var(--shadow)}
.header-inner{max-width:1400px;margin:0 auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.header h1{font-size:1.25rem;font-weight:700}
.header .meta{font-size:.8rem;color:var(--text-secondary)}
.controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.range-btn{padding:5px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);cursor:pointer;font-size:.8rem;font-weight:500;transition:all .15s}
.range-btn:hover,.range-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.date-input{padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);font-size:.8rem}
.theme-toggle{padding:5px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);cursor:pointer;font-size:.9rem}

/* ======== CARDS ======== */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;transition:box-shadow .15s}
.card:hover{box-shadow:var(--shadow-md)}
.card-title{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);font-weight:600;margin-bottom:8px}

/* ======== KPI ROW ======== */
.kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin:24px 0}
@media(max-width:1100px){.kpi-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:600px){.kpi-grid{grid-template-columns:repeat(2,1fr)}}
.kpi-card{cursor:pointer;position:relative}
.kpi-card.highlighted{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
.kpi-value{font-size:1.5rem;font-weight:700;margin-bottom:2px}
.kpi-prev{font-size:.75rem;color:var(--text-secondary)}
.kpi-delta{font-size:.8rem;font-weight:600;margin-left:6px}
.kpi-delta.positive{color:var(--green)}
.kpi-delta.negative{color:var(--red)}
.kpi-sparkline{margin-top:8px}

/* ======== CHART ROWS ======== */
.row-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
@media(max-width:768px){.row-2{grid-template-columns:1fr}}
.chart-container{position:relative;height:300px}
.chart-container canvas{width:100%!important;height:100%!important}

/* ======== ALERTS ======== */
.alert-banner{border-radius:var(--radius);padding:16px 20px;margin-bottom:16px;font-size:.9rem}
.alert-banner.warning{background:var(--yellow-bg);border:1px solid var(--yellow);color:var(--yellow)}
.alert-banner.critical{background:var(--red-bg);border:1px solid var(--red);color:var(--red)}
.severity-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:600;text-transform:uppercase;margin-right:4px}
.severity-badge.info{background:var(--blue-bg);color:var(--blue)}
.severity-badge.warning{background:var(--yellow-bg);color:var(--yellow)}
.severity-badge.critical{background:var(--red-bg);color:var(--red)}

/* ======== LEAK CARD ======== */
.leak-card{margin-bottom:16px}
.leak-card .stage-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:var(--blue-bg);color:var(--blue);margin-right:8px}
.leak-card .metric-comparison{display:flex;gap:24px;margin:12px 0}
.leak-card .metric-box{padding:8px 16px;border-radius:var(--radius-sm);text-align:center;font-size:.85rem}
.leak-card .metric-box.current{background:var(--red-bg);color:var(--red)}
.leak-card .metric-box.baseline{background:var(--green-bg);color:var(--green)}
.leak-card .metric-box .val{font-size:1.3rem;font-weight:700;display:block}
.evidence-list{list-style:disc;margin-left:20px;margin-top:8px;font-size:.85rem;color:var(--text-secondary)}

/* ======== HYPOTHESES ======== */
.hyp-card{margin-bottom:12px;padding:14px}
.hyp-rank{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:.8rem;margin-right:8px}
.hyp-title{font-weight:600;font-size:.9rem}
.pie-bar{height:6px;border-radius:3px;background:var(--border);margin:8px 0;overflow:hidden}
.pie-bar-fill{height:100%;border-radius:3px;background:var(--accent)}
.status-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:600;text-transform:uppercase}
.status-badge.proposed{background:#e5e7eb;color:#374151}
.status-badge.approved{background:var(--blue-bg);color:var(--blue)}
.status-badge.implementing{background:var(--yellow-bg);color:var(--yellow)}
.status-badge.deployed{background:var(--green-bg);color:var(--green)}
.status-badge.verified{background:#fef3c7;color:var(--gold)}
.status-badge.rejected{background:var(--red-bg);color:var(--red)}

/* ======== TABLES ======== */
.data-table{width:100%;border-collapse:collapse;font-size:.85rem}
.data-table th{text-align:left;padding:10px 12px;border-bottom:2px solid var(--border);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);cursor:pointer;user-select:none;white-space:nowrap}
.data-table th:hover{color:var(--accent)}
.data-table th .sort-arrow{margin-left:4px;font-size:.65rem}
.data-table td{padding:8px 12px;border-bottom:1px solid var(--border)}
.data-table tr:last-child td{border-bottom:none}
.data-table tbody tr:hover{background:var(--bg)}

/* ======== CONDITIONAL PANELS ======== */
.cond-panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:16px}
.gauge{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem;margin:0 auto 4px}
.gauge.good{background:var(--green-bg);color:var(--green);border:3px solid var(--green)}
.gauge.warning{background:var(--yellow-bg);color:var(--yellow);border:3px solid var(--yellow)}
.gauge.bad{background:var(--red-bg);color:var(--red);border:3px solid var(--red)}
.no-data{padding:24px;text-align:center;color:var(--text-secondary);font-size:.85rem;font-style:italic}

/* ======== SECTION TITLES ======== */
.section-title{font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
</style>
</head>
<body>

<!-- ============ DATA BLOCKS ============ -->
<script type="application/json" id="dashboard-data">
${JSON.stringify(dashboardData)}
</script>

<!-- ============ HEADER ============ -->
<div class="header">
  <div class="header-inner">
    <div>
      <h1 id="store-name"></h1>
      <div class="meta">Last updated: <span id="last-updated"></span> &middot; <span id="date-range-label"></span></div>
    </div>
    <div class="controls">
      <button class="range-btn active" data-days="7">7d</button>
      <button class="range-btn" data-days="30">30d</button>
      <button class="range-btn" data-days="90">90d</button>
      <input type="date" class="date-input" id="date-start" title="Start date"/>
      <input type="date" class="date-input" id="date-end" title="End date"/>
      <button class="range-btn" id="custom-range-btn">Apply</button>
      <button class="theme-toggle" id="theme-toggle" title="Toggle dark/light mode">&#9790;</button>
    </div>
  </div>
</div>

<div class="container">

  <!-- KPI ROW -->
  <div class="kpi-grid" id="kpi-grid"></div>

  <!-- ROW 2: Revenue Trend + Funnel -->
  <div class="row-2">
    <div class="card"><div class="card-title">Revenue Trend</div><div class="chart-container"><canvas id="revenue-chart"></canvas></div></div>
    <div class="card"><div class="card-title">Funnel</div><div class="chart-container"><canvas id="funnel-chart"></canvas></div></div>
  </div>

  <!-- ROW 3: Device + Ad Performance -->
  <div class="row-2">
    <div class="card"><div class="card-title">Traffic by Device</div><div class="chart-container"><canvas id="device-chart"></canvas></div></div>
    <div class="card"><div class="card-title">Ad Performance (ROAS)</div><div class="chart-container"><canvas id="ads-chart"></canvas></div></div>
  </div>

  <!-- ROW 4: Alerts -->
  <div id="alerts-section"></div>

  <!-- ROW 5: Biggest Funnel Leak -->
  <div id="leak-section"></div>

  <!-- ROW 6: Hypotheses + Experiments -->
  <div class="row-2" id="hyp-exp-row">
    <div class="card" id="hypotheses-panel"><div class="card-title">Top Hypotheses</div><div id="hypotheses-content"></div></div>
    <div class="card" id="experiments-panel"><div class="card-title">Active Experiments</div><div id="experiments-content"></div></div>
  </div>

  <!-- ROW 7: Top Products -->
  <div class="card" style="margin-bottom:16px" id="products-panel">
    <div class="card-title">Top Products</div>
    <div id="products-content"></div>
  </div>

  <!-- Conditional Panels -->
  <div class="cond-panels" id="conditional-panels"></div>

</div>

<!-- ============ MAIN SCRIPT ============ -->
<script>
(function(){
"use strict";

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
const raw = JSON.parse(document.getElementById('dashboard-data').textContent);
const ALL_SNAPSHOTS = (raw.snapshots || []).sort((a,b) => a.date < b.date ? -1 : 1);
const analysis = raw.latestAnalysis;
const hypothesesBatch = raw.latestHypotheses;
const inventoryReport = raw.latestInventory;
const speedReport = raw.latestSpeed;
const cartRecovery = raw.latestCartRecovery;
const seoReport = raw.latestSEO;
const experimentLog = raw.experimentLog;
const baselines = raw.baselines;

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
const html = document.documentElement;
function applyTheme(t){ html.setAttribute('data-theme', t); localStorage.setItem('theme', t); document.getElementById('theme-toggle').textContent = t==='dark' ? '\\u2600' : '\\u263E'; }
const saved = localStorage.getItem('theme');
if(saved) applyTheme(saved);
else if(window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');
document.getElementById('theme-toggle').addEventListener('click', function(){ applyTheme(html.getAttribute('data-theme')==='dark' ? 'light' : 'dark'); rebuildCharts(); });

// ---------------------------------------------------------------------------
// Date range state
// ---------------------------------------------------------------------------
let rangeDays = 7;
let customStart = null;
let customEnd = null;

function getFilteredSnapshots(){
  if(ALL_SNAPSHOTS.length === 0) return [];
  if(customStart && customEnd){
    return ALL_SNAPSHOTS.filter(s => s.date >= customStart && s.date <= customEnd);
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const cutoffStr = cutoff.toISOString().slice(0,10);
  return ALL_SNAPSHOTS.filter(s => s.date >= cutoffStr);
}

function getPreviousPeriodSnapshots(filtered){
  if(filtered.length === 0) return [];
  const start = filtered[0].date;
  const end = filtered[filtered.length-1].date;
  const len = Math.max(1, Math.round((new Date(end) - new Date(start))/(86400000)) + 1);
  const prevEnd = new Date(new Date(start).getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (len-1)*86400000);
  const ps = prevStart.toISOString().slice(0,10);
  const pe = prevEnd.toISOString().slice(0,10);
  return ALL_SNAPSHOTS.filter(s => s.date >= ps && s.date <= pe);
}

// Range buttons
document.querySelectorAll('.range-btn[data-days]').forEach(btn => {
  btn.addEventListener('click', function(){
    document.querySelectorAll('.range-btn[data-days]').forEach(b=>b.classList.remove('active'));
    this.classList.add('active');
    rangeDays = parseInt(this.dataset.days);
    customStart = null; customEnd = null;
    rebuild();
  });
});
document.getElementById('custom-range-btn').addEventListener('click', function(){
  const s = document.getElementById('date-start').value;
  const e = document.getElementById('date-end').value;
  if(s && e && s <= e){ customStart=s; customEnd=e; document.querySelectorAll('.range-btn[data-days]').forEach(b=>b.classList.remove('active')); rebuild(); }
});

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmt(n, prefix, suffix, dec){
  if(n==null) return '—';
  dec = dec ?? (Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 1 ? 1 : 2);
  let s = Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec});
  return (prefix||'') + s + (suffix||'');
}
function fmtPct(n){ return fmt(n,'','\%',1); }
function fmtCurrency(n){ return fmt(n,'$','',2); }
function fmtDelta(d, invert){
  if(d==null) return '';
  const positive = invert ? d < 0 : d > 0;
  const cls = positive ? 'positive' : d === 0 ? '' : 'negative';
  const arrow = d > 0 ? '\\u25B2' : d < 0 ? '\\u25BC' : '';
  return '<span class="kpi-delta '+cls+'">'+arrow+' '+Math.abs(d).toFixed(1)+'\%</span>';
}

// ---------------------------------------------------------------------------
// Sparkline SVG
// ---------------------------------------------------------------------------
function sparklineSVG(values, color){
  if(!values || values.length < 2) return '';
  const w=80, h=24, pad=2;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v,i) => {
    const x = pad + (i/(values.length-1))*(w-2*pad);
    const y = pad + (1-(v-min)/range)*(h-2*pad);
    return x.toFixed(1)+','+y.toFixed(1);
  });
  return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" style="display:block"><polyline fill="none" stroke="'+(color||'var(--accent)')+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="'+pts.join(' ')+'"/></svg>';
}

// ---------------------------------------------------------------------------
// KPI Cards
// ---------------------------------------------------------------------------
const KPI_DEFS = [
  { key:'sessions', label:'Sessions', extract: s=>s.ga4?.sessions, format: v=>fmt(v), invert:false },
  { key:'revenue', label:'Revenue', extract: s=>s.ga4?.revenue, format: v=>fmtCurrency(v), invert:false },
  { key:'orders', label:'Orders', extract: s=>s.shopify?.orders, format: v=>fmt(v), invert:false },
  { key:'aov', label:'AOV', extract: s=>s.shopify?.aov, format: v=>fmtCurrency(v), invert:false },
  { key:'conversion_rate', label:'Conversion Rate', extract: s=>s.ga4?.conversion_rate, format: v=>fmtPct(v), invert:false },
  { key:'bounce_rate', label:'Bounce Rate', extract: s=>s.ga4?.bounce_rate, format: v=>fmtPct(v), invert:true },
];

function buildKPICards(filtered, previous){
  const grid = document.getElementById('kpi-grid');
  grid.innerHTML = '';
  KPI_DEFS.forEach(def => {
    const last = filtered.length ? def.extract(filtered[filtered.length-1]) : null;
    const values = filtered.map(s => { const m=def.extract(s); return m ? m.value : null; }).filter(v=>v!=null);
    const sparkValues = values.slice(-7);
    const currentVal = last ? last.value : null;
    const prevVal = last ? last.previous : null;
    const delta = last ? last.delta_pct : null;

    const card = document.createElement('div');
    card.className = 'card kpi-card';
    card.dataset.kpi = def.key;
    card.innerHTML =
      '<div class="card-title">'+def.label+'</div>'+
      '<div class="kpi-value">'+def.format(currentVal)+fmtDelta(delta, def.invert)+'</div>'+
      '<div class="kpi-prev">Prev: '+def.format(prevVal)+'</div>'+
      '<div class="kpi-sparkline">'+sparklineSVG(sparkValues, def.invert ? 'var(--red)' : 'var(--accent)')+'</div>';
    card.addEventListener('click', function(){ highlightKPI(def.key); });
    grid.appendChild(card);
  });
}

let highlightedKPI = null;
function highlightKPI(key){
  document.querySelectorAll('.kpi-card').forEach(c => c.classList.toggle('highlighted', c.dataset.kpi===key && highlightedKPI!==key));
  highlightedKPI = highlightedKPI===key ? null : key;
  rebuildCharts();
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------
let chartInstances = {};

function isDark(){ return document.documentElement.getAttribute('data-theme')==='dark'; }
function gridColor(){ return isDark() ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)'; }
function textColor(){ return isDark() ? '#94a3b8' : '#6b7280'; }

function rebuildCharts(){
  const filtered = getFilteredSnapshots();
  buildRevenueChart(filtered);
  buildFunnelChart(filtered);
  buildDeviceChart(filtered);
  buildAdsChart(filtered);
}

function destroyChart(id){ if(chartInstances[id]){ chartInstances[id].destroy(); delete chartInstances[id]; } }

function buildRevenueChart(filtered){
  destroyChart('revenue');
  const ctx = document.getElementById('revenue-chart').getContext('2d');
  const labels = filtered.map(s=>s.date);
  const datasets = [];

  // Always show revenue
  datasets.push({
    label:'Revenue',
    data: filtered.map(s => s.ga4?.revenue?.value ?? 0),
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37,99,235,0.08)',
    fill: true,
    tension: 0.3,
    pointRadius: filtered.length > 30 ? 0 : 3,
  });

  // If a KPI is highlighted, overlay it
  if(highlightedKPI && highlightedKPI !== 'revenue'){
    const def = KPI_DEFS.find(k=>k.key===highlightedKPI);
    if(def){
      datasets.push({
        label: def.label,
        data: filtered.map(s => { const m=def.extract(s); return m ? m.value : 0; }),
        borderColor: '#7c3aed',
        backgroundColor: 'transparent',
        borderDash: [5,3],
        tension: 0.3,
        pointRadius: 0,
        yAxisID: 'y1',
      });
    }
  }

  const scales = {
    x: { grid:{color:gridColor()}, ticks:{color:textColor(), maxTicksLimit:10, font:{size:11}} },
    y: { grid:{color:gridColor()}, ticks:{color:textColor(), font:{size:11}, callback:function(v){return '$'+v.toLocaleString();}} },
  };
  if(datasets.length > 1){
    scales.y1 = { position:'right', grid:{drawOnChartArea:false}, ticks:{color:'#7c3aed', font:{size:11}} };
  }

  chartInstances['revenue'] = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textColor()}}}, scales }
  });
}

function buildFunnelChart(filtered){
  destroyChart('funnel');
  const ctx = document.getElementById('funnel-chart').getContext('2d');
  // Aggregate funnel from latest snapshot
  const latest = filtered.length ? filtered[filtered.length-1] : null;
  const funnel = latest?.ga4?.funnel || {product_views:0,add_to_cart:0,begin_checkout:0,purchase:0};
  const stages = ['product_views','add_to_cart','begin_checkout','purchase'];
  const stageLabels = ['Product Views','Add to Cart','Begin Checkout','Purchase'];
  const vals = stages.map(s => funnel[s] || 0);
  const colors = ['#3b82f6','#6366f1','#8b5cf6','#059669'];

  // Compute drop-off labels
  const dropLabels = stageLabels.map((l,i) => {
    if(i===0 || vals[i-1]===0) return l;
    const drop = ((1 - vals[i]/vals[i-1])*100).toFixed(1);
    return l + ' (-'+drop+'\%)';
  });

  chartInstances['funnel'] = new Chart(ctx, {
    type:'bar',
    data:{
      labels: dropLabels,
      datasets:[{ data:vals, backgroundColor:colors, borderRadius:4 }]
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{color:gridColor()},ticks:{color:textColor(),font:{size:11}}},
        y:{grid:{display:false},ticks:{color:textColor(),font:{size:11}}}
      }
    }
  });
}

function buildDeviceChart(filtered){
  destroyChart('device');
  const ctx = document.getElementById('device-chart').getContext('2d');
  const latest = filtered.length ? filtered[filtered.length-1] : null;
  const dev = latest?.ga4?.device_breakdown || {desktop:0,mobile:0,tablet:0};
  chartInstances['device'] = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:['Desktop','Mobile','Tablet'],
      datasets:[{
        data:[dev.desktop, dev.mobile, dev.tablet],
        backgroundColor:['#3b82f6','#8b5cf6','#06b6d4'],
        borderWidth:0
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{color:textColor(),padding:16,font:{size:12}}}}
    }
  });
}

function buildAdsChart(filtered){
  destroyChart('ads');
  const ctx = document.getElementById('ads-chart').getContext('2d');
  const labels = filtered.map(s=>s.date);
  const googleROAS = filtered.map(s => s.ads?.google_ads?.roas ?? null);
  const metaROAS = filtered.map(s => s.ads?.meta_ads?.roas ?? null);

  chartInstances['ads'] = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'Google ROAS', data:googleROAS, borderColor:'#4285f4', backgroundColor:'transparent', tension:0.3, pointRadius: filtered.length>30?0:3 },
        { label:'Meta ROAS', data:metaROAS, borderColor:'#0668E1', backgroundColor:'transparent', tension:0.3, borderDash:[4,3], pointRadius: filtered.length>30?0:3 },
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:textColor()}},
        annotation: undefined
      },
      scales:{
        x:{grid:{color:gridColor()},ticks:{color:textColor(),maxTicksLimit:10,font:{size:11}}},
        y:{grid:{color:gridColor()},ticks:{color:textColor(),font:{size:11}},
          min:0
        }
      }
    },
    plugins:[{
      id:'thresholdLines',
      afterDraw(chart){
        const yScale = chart.scales.y;
        const ctx2 = chart.ctx;
        [3.0, 2.5].forEach((thresh, i) => {
          const y = yScale.getPixelForValue(thresh);
          if(y == null || y < chart.chartArea.top || y > chart.chartArea.bottom) return;
          ctx2.save();
          ctx2.beginPath();
          ctx2.setLineDash([6,4]);
          ctx2.strokeStyle = i===0 ? '#059669' : '#d97706';
          ctx2.lineWidth = 1;
          ctx2.moveTo(chart.chartArea.left, y);
          ctx2.lineTo(chart.chartArea.right, y);
          ctx2.stroke();
          ctx2.fillStyle = i===0 ? '#059669' : '#d97706';
          ctx2.font = '10px sans-serif';
          ctx2.fillText(thresh.toFixed(1), chart.chartArea.right+4, y+3);
          ctx2.restore();
        });
      }
    }]
  });
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
function buildAlerts(){
  const section = document.getElementById('alerts-section');
  section.innerHTML = '';

  // Ad alerts from latest analysis or latest snapshot
  const adAlerts = analysis?.anomalies?.filter(a => a.severity==='warning'||a.severity==='critical') || [];

  if(adAlerts.length > 0){
    const maxSev = adAlerts.some(a=>a.severity==='critical') ? 'critical' : 'warning';
    let html = '<div class="alert-banner '+maxSev+'"><strong>'+(maxSev==='critical'?'\\u26A0 Critical Alerts':'\\u26A0 Warnings')+'</strong><div style="margin-top:8px">';
    adAlerts.forEach(a => {
      html += '<div style="margin-bottom:6px"><span class="severity-badge '+a.severity+'">'+a.severity+'</span> <strong>'+escHTML(a.metric)+'</strong> ('+a.source+'): '+a.value+' — expected '+a.expected_range.low.toFixed(2)+'–'+a.expected_range.high.toFixed(2)+'</div>';
    });
    html += '</div></div>';
    section.innerHTML = html;
  }
}

// ---------------------------------------------------------------------------
// Biggest Leak
// ---------------------------------------------------------------------------
function buildLeak(){
  const section = document.getElementById('leak-section');
  section.innerHTML = '';
  if(!analysis?.biggest_leak) return;
  const leak = analysis.biggest_leak;
  let html = '<div class="card leak-card"><div class="card-title">Biggest Funnel Leak</div>';
  html += '<div style="margin-bottom:8px"><span class="stage-badge">'+escHTML(leak.stage)+'</span><strong>'+escHTML(leak.metric)+'</strong></div>';
  html += '<div class="metric-comparison">';
  html += '<div class="metric-box current"><span class="val">'+leak.current_value+'</span>Current</div>';
  html += '<div class="metric-box baseline"><span class="val">'+leak.baseline_value+'</span>Baseline</div>';
  html += '</div>';
  html += '<div style="font-size:.9rem;margin-bottom:6px"><strong>Impact:</strong> '+escHTML(leak.impact_estimate)+'</div>';
  if(leak.evidence?.length){
    html += '<ul class="evidence-list">';
    leak.evidence.forEach(e => html += '<li>'+escHTML(e)+'</li>');
    html += '</ul>';
  }
  html += '</div>';
  section.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Hypotheses
// ---------------------------------------------------------------------------
function buildHypotheses(){
  const container = document.getElementById('hypotheses-content');
  const hyps = hypothesesBatch?.hypotheses || [];
  if(hyps.length === 0){ container.innerHTML = '<div class="no-data">No hypotheses yet — the hypothesis agent will generate them after analysis.</div>'; return; }
  let html = '';
  hyps.sort((a,b)=>a.rank-b.rank).forEach(h => {
    const pct = ((h.scores?.total||0)/30*100).toFixed(0);
    html += '<div class="card hyp-card">';
    html += '<div><span class="hyp-rank">'+h.rank+'</span><span class="hyp-title">'+escHTML(h.title)+'</span> <span class="status-badge '+(h.status||'proposed')+'">'+escHTML(h.status||'proposed')+'</span></div>';
    html += '<div class="pie-bar"><div class="pie-bar-fill" style="width:'+pct+'\%"></div></div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-secondary)"><span>PIE: '+(h.scores?.total?.toFixed(1)||'—')+'</span><span>Expected lift: +'+(h.expected_lift_pct||0).toFixed(1)+'\%</span></div>';
    html += '</div>';
  });
  container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------
function buildExperiments(){
  const container = document.getElementById('experiments-content');
  const exps = experimentLog?.experiments || [];
  if(exps.length===0){ container.innerHTML = '<div class="no-data">No experiments yet — approve a hypothesis to start.</div>'; return; }
  let html = '<table class="data-table"><thead><tr><th data-col="id">ID</th><th data-col="status">Status</th><th data-col="changes_summary">Summary</th><th data-col="lift">Lift \%</th></tr></thead><tbody>';
  exps.forEach(exp => {
    const lift = exp.verification?.lift_pct;
    const daysLive = exp.deployed_at ? Math.round((Date.now()-new Date(exp.deployed_at).getTime())/86400000) : '—';
    html += '<tr><td>'+escHTML(exp.id)+'</td><td><span class="status-badge '+(exp.status||'')+'">'+escHTML(exp.status)+'</span></td><td>'+escHTML(exp.changes_summary||'')+'<br><span style="font-size:.75rem;color:var(--text-secondary)">'+daysLive+' days live</span></td><td>'+(lift!=null ? lift.toFixed(1)+'\%' : '—')+'</td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Top Products Table (sortable)
// ---------------------------------------------------------------------------
function buildProducts(filtered){
  const container = document.getElementById('products-content');
  const latest = filtered.length ? filtered[filtered.length-1] : null;
  const products = latest?.shopify?.top_products || [];
  if(products.length===0){ container.innerHTML = '<div class="no-data">No product data yet — connect Shopify to see top products.</div>'; return; }

  let sortCol = 'revenue';
  let sortAsc = false;

  function render(){
    const sorted = [...products].sort((a,b) => {
      const va = a[sortCol]??0, vb = b[sortCol]??0;
      return sortAsc ? va-vb : vb-va;
    });
    let html = '<table class="data-table" id="products-table"><thead><tr>';
    [['title','Product'],['units_sold','Units Sold'],['revenue','Revenue'],['conversion_rate','Conv. Rate']].forEach(([col,label]) => {
      const arrow = sortCol===col ? (sortAsc?' \\u25B2':' \\u25BC') : '';
      html += '<th data-sort="'+col+'">'+label+'<span class="sort-arrow">'+arrow+'</span></th>';
    });
    html += '</tr></thead><tbody>';
    sorted.forEach(p => {
      html += '<tr><td>'+escHTML(p.title)+'</td><td>'+p.units_sold+'</td><td>$'+p.revenue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td>'+p.conversion_rate.toFixed(2)+'\%</td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;

    container.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', function(){
        const col2 = this.dataset.sort;
        if(sortCol===col2) sortAsc=!sortAsc; else { sortCol=col2; sortAsc=col2==='title'; }
        render();
      });
    });
  }
  render();
}

// ---------------------------------------------------------------------------
// Conditional panels
// ---------------------------------------------------------------------------
function buildConditionalPanels(){
  const wrap = document.getElementById('conditional-panels');
  wrap.innerHTML = '';
  const panels = [];

  // Inventory
  if(inventoryReport){
    const inv = inventoryReport;
    let html = '<div class="card"><div class="card-title">Inventory Alerts</div>';
    const alerts = inv.stock_alerts || inv.inventory_alerts || [];
    html += '<div style="font-size:1.4rem;font-weight:700">'+alerts.length+' alert'+(alerts.length!==1?'s':'')+'</div>';
    if(inv.out_of_stock_count != null) html += '<div style="font-size:.85rem;color:var(--text-secondary)">Out of stock: '+inv.out_of_stock_count+'</div>';
    if(inv.dead_stock_value != null) html += '<div style="font-size:.85rem;color:var(--text-secondary)">Dead stock value: $'+inv.dead_stock_value.toLocaleString()+'</div>';
    html += '</div>';
    panels.push(html);
  }

  // Speed
  if(speedReport){
    const sp = speedReport;
    function gaugeClass(metric, val){
      if(metric==='lcp') return val < 2.5 ? 'good' : val < 4 ? 'warning' : 'bad';
      if(metric==='inp') return val < 200 ? 'good' : val < 500 ? 'warning' : 'bad';
      if(metric==='cls') return val < 0.1 ? 'good' : val < 0.25 ? 'warning' : 'bad';
      return 'good';
    }
    let html = '<div class="card"><div class="card-title">Site Speed (Core Web Vitals)</div><div style="display:flex;gap:24px;justify-content:center;margin-top:12px">';
    [['lcp','LCP','s'],['inp','INP','ms'],['cls','CLS','']].forEach(([k,l,u]) => {
      const v = sp[k];
      if(v!=null){
        html += '<div style="text-align:center"><div class="gauge '+gaugeClass(k,v)+'">'+v+(u?u:'')+'</div><div style="font-size:.75rem;color:var(--text-secondary)">'+l+'</div></div>';
      }
    });
    html += '</div></div>';
    panels.push(html);
  }

  // SEO
  if(seoReport){
    const kws = seoReport.keyword_opportunities || [];
    const strike = kws.filter(k=>k.opportunity_type==='strike_distance').slice(0,5);
    let html = '<div class="card"><div class="card-title">SEO Opportunities</div>';
    html += '<div style="font-size:1.4rem;font-weight:700">'+kws.length+' keyword'+(kws.length!==1?'s':'')+'</div>';
    if(strike.length){
      html += '<div style="margin-top:8px;font-size:.8rem;font-weight:600;color:var(--text-secondary)">Top Strike-Distance Keywords</div><ul style="margin:4px 0 0 16px;font-size:.85rem">';
      strike.forEach(s => html += '<li>'+escHTML(s.query)+' (pos '+s.position.toFixed(1)+')</li>');
      html += '</ul>';
    }
    html += '</div>';
    panels.push(html);
  }

  // Cart Recovery
  if(cartRecovery){
    let html = '<div class="card"><div class="card-title">Cart Recovery</div>';
    if(cartRecovery.abandonment_rate!=null) html += '<div style="font-size:.85rem">Abandonment rate: <strong>'+cartRecovery.abandonment_rate.toFixed(1)+'\%</strong></div>';
    if(cartRecovery.recovery_rate!=null) html += '<div style="font-size:.85rem">Recovery rate: <strong>'+cartRecovery.recovery_rate.toFixed(1)+'\%</strong></div>';
    html += '</div>';
    panels.push(html);
  }

  if(panels.length === 0) return;
  wrap.innerHTML = panels.join('');
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function escHTML(s){ if(!s)return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ---------------------------------------------------------------------------
// Master rebuild
// ---------------------------------------------------------------------------
function rebuild(){
  const filtered = getFilteredSnapshots();
  const previous = getPreviousPeriodSnapshots(filtered);

  // Header
  document.getElementById('store-name').textContent = raw.storeName;
  document.getElementById('last-updated').textContent = raw.generatedAt ? new Date(raw.generatedAt).toLocaleString() : '—';
  const rangeLabel = filtered.length ? filtered[0].date + ' to ' + filtered[filtered.length-1].date + ' ('+filtered.length+' days)' : 'No data';
  document.getElementById('date-range-label').textContent = rangeLabel;

  buildKPICards(filtered, previous);
  rebuildCharts();
  buildAlerts();
  buildLeak();
  buildHypotheses();
  buildExperiments();
  buildProducts(filtered);
  buildConditionalPanels();
}

// Initial build
rebuild();

})();
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

const outPath = join(OUT_DIR, 'index.html');
writeFileSync(outPath, html, 'utf-8');

console.log(`✅ Dashboard written to ${outPath}`);
console.log(`   Snapshots bundled: ${snapshots.length}`);
console.log(`   Analysis: ${latestAnalysis ? 'yes' : 'none'}`);
console.log(`   Hypotheses: ${latestHypotheses ? 'yes' : 'none'}`);
console.log(`   Experiments: ${experimentLog ? 'yes' : 'none'}`);
console.log(`   Inventory report: ${latestInventory ? 'yes' : 'none'}`);
console.log(`   Speed report: ${latestSpeed ? 'yes' : 'none'}`);
console.log(`   SEO report: ${latestSEO ? 'yes' : 'none'}`);
console.log(`   Cart recovery: ${latestCartRecovery ? 'yes' : 'none'}`);
