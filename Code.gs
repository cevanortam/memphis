// ============================================================
// LEAN CORNER DASHBOARD — Google Apps Script Backend
// Deploy as Web App: Execute as Me, Anyone can access
// ============================================================

const SPREADSHEET_ID = ''; // ← PASTE YOUR GOOGLE SHEET ID HERE after creating it
// OR leave blank and the script will create a new Sheet automatically on first run.

function getOrCreateSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  // Auto-create if not set
  const ss = SpreadsheetApp.create('LeanCorner_Data');
  Logger.log('Created new spreadsheet: ' + ss.getId());
  return ss;
}

// ── CORS helper ──────────────────────────────────────────────
function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  let result;
  try {
    if (action === 'getConfig')       result = getConfig();
    else if (action === 'getTabs')    result = getTabs();
    else if (action === 'getMetrics') result = getMetrics(params.tab);
    else if (action === 'getData')    result = getData(params.tab, params.metric);
    else if (action === 'getAllData') result = getAllData(params.tab);
    else result = { error: 'Unknown action: ' + action };
  } catch (err) {
    result = { error: err.toString() };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return jsonOut({ error: 'Invalid JSON body' }); }

  const action = body.action;
  let result;
  try {
    if (action === 'saveConfig')        result = saveConfig(body.data);
    else if (action === 'saveTab')      result = saveTab(body.data);
    else if (action === 'deleteTab')    result = deleteTab(body.tabName);
    else if (action === 'saveMetric')   result = saveMetric(body.tabName, body.data);
    else if (action === 'deleteMetric') result = deleteMetric(body.tabName, body.metricKey);
    else if (action === 'pasteData')    result = pasteData(body.tabName, body.metricKey, body.dates, body.values);
    else if (action === 'appendDay')    result = appendDay(body.tabName, body.metricKey, body.date, body.value);
    else result = { error: 'Unknown action: ' + action };
  } catch (err) {
    result = { error: err.toString() };
  }
  return jsonOut(result);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── CONFIG sheet: stores tab list + global settings ──────────
function getConfig() {
  const ss = getOrCreateSpreadsheet();
  let sheet = ss.getSheetByName('_config');
  if (!sheet) return { tabs: [], settings: {} };
  const data = sheet.getDataRange().getValues();
  const config = { tabs: [], settings: {} };
  data.forEach(row => {
    if (row[0] === 'TAB') {
      config.tabs.push(JSON.parse(row[1]));
    } else if (row[0] === 'SETTING') {
      config.settings[row[1]] = row[2];
    }
  });
  return config;
}

function saveConfig(data) {
  const ss = getOrCreateSpreadsheet();
  let sheet = ss.getSheetByName('_config');
  if (!sheet) sheet = ss.insertSheet('_config');
  sheet.clearContents();
  const rows = [];
  if (data.tabs) {
    data.tabs.forEach(tab => rows.push(['TAB', JSON.stringify(tab)]));
  }
  if (data.settings) {
    Object.entries(data.settings).forEach(([k, v]) => rows.push(['SETTING', k, v]));
  }
  if (rows.length) sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  return { ok: true };
}

function getTabs() {
  const config = getConfig();
  return { tabs: config.tabs };
}

// ── METRIC DEFINITIONS: stored per-tab in _metrics_{tabKey} ──
function getMetrics(tabKey) {
  const ss = getOrCreateSpreadsheet();
  const sheetName = '_metrics_' + sanitize(tabKey);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { metrics: [] };
  const data = sheet.getDataRange().getValues();
  const metrics = data.slice(1).map(row => JSON.parse(row[1] || '{}')).filter(m => m.key);
  return { metrics };
}

function saveMetric(tabKey, metricDef) {
  const ss = getOrCreateSpreadsheet();
  const sheetName = '_metrics_' + sanitize(tabKey);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['key', 'definition']);
  }
  // Upsert
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === metricDef.key) {
      sheet.getRange(i + 1, 1, 1, 2).setValues([[metricDef.key, JSON.stringify(metricDef)]]);
      return { ok: true, action: 'updated' };
    }
  }
  sheet.appendRow([metricDef.key, JSON.stringify(metricDef)]);
  return { ok: true, action: 'created' };
}

function deleteMetric(tabKey, metricKey) {
  const ss = getOrCreateSpreadsheet();
  const sheetName = '_metrics_' + sanitize(tabKey);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: true };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === metricKey) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  // Also delete data sheet
  const dataSheet = ss.getSheetByName('data_' + sanitize(tabKey) + '_' + sanitize(metricKey));
  if (dataSheet) ss.deleteSheet(dataSheet);
  return { ok: true };
}

// ── TAB CRUD ─────────────────────────────────────────────────
function saveTab(tabDef) {
  const config = getConfig();
  const idx = config.tabs.findIndex(t => t.key === tabDef.key);
  if (idx >= 0) config.tabs[idx] = tabDef;
  else config.tabs.push(tabDef);
  return saveConfig(config);
}

function deleteTab(tabKey) {
  const ss = getOrCreateSpreadsheet();
  const config = getConfig();
  config.tabs = config.tabs.filter(t => t.key !== tabKey);
  saveConfig(config);
  // Remove all related sheets
  ss.getSheets().forEach(s => {
    const n = s.getName();
    if (n === '_metrics_' + sanitize(tabKey) || n.startsWith('data_' + sanitize(tabKey) + '_')) {
      ss.deleteSheet(s);
    }
  });
  return { ok: true };
}

// ── DATA: stored in sheet per metric: data_{tabKey}_{metricKey}
// Row 1: header (date, value)
// Rows 2+: ISO date string, numeric value
function getData(tabKey, metricKey) {
  const ss = getOrCreateSpreadsheet();
  const sheetName = 'data_' + sanitize(tabKey) + '_' + sanitize(metricKey);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { points: [] };
  const rows = sheet.getDataRange().getValues().slice(1);
  const points = rows
    .filter(r => r[0] && r[1] !== '')
    .map(r => ({ date: formatDate(r[0]), value: parseFloat(r[1]) }));
  return { points };
}

function getAllData(tabKey) {
  const { metrics } = getMetrics(tabKey);
  const result = {};
  metrics.forEach(m => {
    result[m.key] = getData(tabKey, m.key).points;
  });
  return { data: result };
}

// Paste mode: dates array + values array (parallel)
function pasteData(tabKey, metricKey, dates, values) {
  const ss = getOrCreateSpreadsheet();
  const sheetName = 'data_' + sanitize(tabKey) + '_' + sanitize(metricKey);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['date', 'value']);
  }
  // Build map of existing dates
  const existing = sheet.getDataRange().getValues();
  const dateMap = {};
  existing.slice(1).forEach((row, i) => {
    if (row[0]) dateMap[formatDate(row[0])] = i + 2; // 1-indexed + header
  });

  const toAdd = [];
  dates.forEach((d, i) => {
    const iso = normalizeDate(d);
    const val = values[i];
    if (iso && val !== '' && val !== null && val !== undefined) {
      if (dateMap[iso]) {
        // Update existing
        sheet.getRange(dateMap[iso], 2).setValue(val);
      } else {
        toAdd.push([iso, val]);
      }
    }
  });
  if (toAdd.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, 2).setValues(toAdd);
  }
  // Sort by date
  const allData = sheet.getDataRange().getValues();
  if (allData.length > 2) {
    const header = allData[0];
    const dataRows = allData.slice(1).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    sheet.clearContents();
    sheet.getRange(1, 1, 1, 2).setValues([header]);
    sheet.getRange(2, 1, dataRows.length, 2).setValues(dataRows);
  }
  return { ok: true, added: toAdd.length };
}

function appendDay(tabKey, metricKey, date, value) {
  return pasteData(tabKey, metricKey, [date], [value]);
}

// ── Helpers ───────────────────────────────────────────────────
function sanitize(str) {
  return String(str).replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 30);
}

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.substring(0, 10);
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDate(str) {
  if (!str) return null;
  str = String(str).trim();
  // Try MM/DD/YYYY
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].length === 4) { y = parts[0]; m = parts[1]; d = parts[2]; }
    else { m = parts[0]; d = parts[1]; y = parts[2]; }
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return str.substring(0, 10);
}
