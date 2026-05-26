/* ═══════════════════════════════════════════════════════════
   LEAN CORNER — Shared Utilities
═══════════════════════════════════════════════════════════ */

// ── API CONFIG ────────────────────────────────────────────────
// After deploying your Apps Script, paste the web app URL here.
const API_URL = localStorage.getItem('lc_api_url') || 'https://script.google.com/macros/s/AKfycbwrPedBNwsYajOrU8WqrLPxf1Su4iEOd97YWpY3z-nLW9GqGe3tfu3kN2VoLm2DCgWg/exec';

const API = {
  async get(action, params = {}) {
    if (!API_URL) throw new Error('API URL not configured. Go to Setup to enter your Apps Script URL.');
    const qs = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${API_URL}?${qs}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  },
  async post(body) {
    if (!API_URL) throw new Error('API URL not configured. Go to Setup to enter your Apps Script URL.');
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // avoid CORS preflight
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  },
};

// ── LOCAL CONFIG CACHE ────────────────────────────────────────
const Config = {
  _key: 'lc_config',
  get() {
    try { return JSON.parse(localStorage.getItem(this._key)) || { tabs: [], settings: {} }; }
    catch { return { tabs: [], settings: {} }; }
  },
  set(cfg) { localStorage.setItem(this._key, JSON.stringify(cfg)); },
  async load() {
    const cfg = await API.get('getConfig');
    this.set(cfg);
    return cfg;
  },
  async save(cfg) {
    await API.post({ action: 'saveConfig', data: cfg });
    this.set(cfg);
  },
  getTabs() { return this.get().tabs || []; },
  getSettings() { return this.get().settings || {}; },
};

// ── DATA CACHE (session) ──────────────────────────────────────
const DataCache = {
  _store: {},
  key(tab, metric) { return `${tab}::${metric}`; },
  set(tab, metric, points) { this._store[this.key(tab, metric)] = points; },
  get(tab, metric) { return this._store[this.key(tab, metric)] || null; },
  clear(tab) {
    Object.keys(this._store).forEach(k => { if (k.startsWith(tab + '::')) delete this._store[k]; });
  },
};

// ── DATE HELPERS ──────────────────────────────────────────────
const DateUtils = {
  toISO(d) {
    if (!d) return null;
    if (d instanceof Date) {
      return d.toISOString().substring(0, 10);
    }
    return String(d).substring(0, 10);
  },
  parseISO(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  label(iso, granularity) {
    const d = this.parseISO(iso);
    if (!d) return iso;
    switch (granularity) {
      case 'day':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week': {
        const wk = this.isoWeek(d);
        return `W${wk} '${String(d.getFullYear()).slice(2)}`;
      }
      case 'month':
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      case 'year':
        return String(d.getFullYear());
      default:
        return iso;
    }
  },
  isoWeek(d) {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  },
  groupKey(iso, granularity) {
    const d = this.parseISO(iso);
    if (!d) return iso;
    switch (granularity) {
      case 'day':   return iso;
      case 'week':  {
        const wk = this.isoWeek(d);
        return `${d.getFullYear()}-W${String(wk).padStart(2,'0')}`;
      }
      case 'month': return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      case 'year':  return `${d.getFullYear()}`;
    }
  },
  aggregatePoints(points, granularity, aggFunc = 'avg') {
    // Group
    const groups = {};
    const groupOrder = [];
    points.forEach(p => {
      const gk = this.groupKey(p.date, granularity);
      if (!groups[gk]) { groups[gk] = []; groupOrder.push(gk); }
      groups[gk].push(p.value);
    });
    // Deduplicate order
    const seen = new Set();
    const orderedKeys = groupOrder.filter(k => seen.has(k) ? false : (seen.add(k), true));
    orderedKeys.sort();
    return orderedKeys.map(gk => {
      const vals = groups[gk].filter(v => !isNaN(v));
      let value;
      if (vals.length === 0) value = null;
      else if (aggFunc === 'sum') value = vals.reduce((a,b) => a+b, 0);
      else value = vals.reduce((a,b) => a+b, 0) / vals.length;
      return { groupKey: gk, value: value !== null ? Math.round(value * 100) / 100 : null };
    });
  },
};

// ── NUMBER FORMAT ─────────────────────────────────────────────
function fmtVal(v, fmt) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  switch (fmt) {
    case 'percent': return v.toFixed(2) + '%';
    case 'integer': return Math.round(v).toLocaleString();
    case 'decimal': return v.toFixed(2);
    default:        return v.toFixed(2);
  }
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
    return el;
  })();
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── CHART BUILDER (Chart.js wrapper) ──────────────────────────
function buildChart(canvas, { labels, values, target, format, chartType = 'bar', color = '#cc0000' }) {
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const isPercent = format === 'percent';
  const hasTarget = target !== null && target !== undefined && !isNaN(parseFloat(target));
  const targetVal = parseFloat(target);

  const datasets = [{
    data: values,
    backgroundColor: values.map(v => {
      if (!hasTarget || v === null) return color;
      return v >= targetVal ? '#22c55e' : color;
    }),
    borderColor: 'transparent',
    borderRadius: 3,
    barPercentage: 0.75,
    categoryPercentage: 0.85,
  }];

  if (hasTarget) {
    datasets.push({
      type: 'line',
      data: Array(labels.length).fill(targetVal),
      borderColor: '#ffffff44',
      borderDash: [5, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      label: 'Target',
    });
  }

  const cfg = {
    type: chartType === 'line' ? 'line' : 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f2040',
          borderColor: '#1a3058',
          borderWidth: 1,
          titleColor: '#b0c0d0',
          bodyColor: '#ffffff',
          callbacks: {
            label: ctx => fmtVal(ctx.parsed.y, format),
          },
        },
        datalabels: {
          display: labels.length <= 24,
          color: '#ffffff',
          font: { size: 9, weight: '600' },
          anchor: 'end', align: 'top',
          formatter: v => v === null ? '' : fmtVal(v, format),
          padding: { bottom: 2 },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#8899aa',
            font: { size: 10, family: 'Barlow Condensed' },
            maxRotation: 45,
          },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: {
            color: '#8899aa',
            font: { size: 10 },
            callback: v => isPercent ? v + '%' : v,
          },
          beginAtZero: true,
        },
      },
    },
  };

  if (chartType === 'line') {
    datasets[0].type = 'line';
    datasets[0].borderColor = color;
    datasets[0].backgroundColor = color + '22';
    datasets[0].fill = true;
    datasets[0].tension = 0.3;
    datasets[0].pointRadius = 3;
    delete datasets[0].barPercentage;
    delete datasets[0].categoryPercentage;
    delete datasets[0].borderRadius;
  }

  canvas._chartInstance = new Chart(canvas, cfg);
  return canvas._chartInstance;
}
