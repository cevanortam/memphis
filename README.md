# Lean Corner Dashboard

A multi-tab warehouse KPI dashboard for CEVA Logistics, hosted on GitHub Pages with Google Sheets as the backend.

---

## File Structure

```
lean-corner/
├── dashboard.html       ← Main dashboard view
├── data-entry.html      ← Paste historical data / add daily entries
├── setup.html           ← Configure tabs, metrics, and chart layouts
├── css/
│   └── shared.css
├── js/
│   └── shared.js
└── Code.gs              ← Google Apps Script backend (paste into Apps Script)
```

---

## Step 1 — Set Up Google Sheets + Apps Script

### 1a. Create a Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it anything you want (e.g. **LeanCorner_Data**).
3. Copy the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/` **`THIS_PART`** `/edit`

### 1b. Create the Apps Script
1. Inside the spreadsheet, go to **Extensions → Apps Script**.
2. Delete all existing code in the editor.
3. Open `Code.gs` from this project and paste the **entire contents** into the editor.
4. At the top of the script, find this line and paste your Spreadsheet ID:
   ```js
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
   ```
   *(If you leave it blank, the script will create a new sheet automatically on first run.)*
5. Click **Save** (💾).

### 1c. Deploy as a Web App
1. Click **Deploy → New deployment**.
2. Click the ⚙️ gear icon next to "Select type" → choose **Web app**.
3. Fill in:
   - **Description**: `LeanCorner API v1`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**.
5. Click **Authorize access** and complete the Google permissions flow.
6. Copy the **Web app URL** — it looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`

> ⚠️ Every time you edit `Code.gs`, you must create a **New Deployment** (not "Manage deployments → edit") to publish the changes.

---

## Step 2 — Set Up GitHub Pages

1. Create a new GitHub repository (e.g. `lean-corner`).
2. Upload all files maintaining the folder structure:
   ```
   dashboard.html
   data-entry.html
   setup.html
   css/shared.css
   js/shared.js
   ```
   *(Do **not** upload `Code.gs` — that lives in Apps Script only.)*
3. Go to **Settings → Pages**.
4. Under **Source**, select `Deploy from a branch` → `main` → `/ (root)`.
5. Click **Save**. Your site will be live at:
   `https://YOUR_USERNAME.github.io/lean-corner/dashboard.html`

---

## Step 3 — First-Time Configuration

1. Go to `setup.html` on your GitHub Pages site.
2. Paste your **Apps Script Web App URL** in the API URL field and click **Save**, then **Test**.
3. Click **+ Add Tab** to create your first dashboard page (e.g. "Nike — Millington").
4. Select the tab, then click **+ Add Metric** for each KPI:
   - Name: `Dock to Stock`
   - Key: `dock_to_stock` (auto-filled)
   - Target: `99`
   - Format: `Percent`
   - Direction: `≥ Target is good`
5. Drag metrics from the pool onto the grid to set the layout.
6. Click **Save Layout**.

---

## Step 4 — Loading Historical Data

1. Go to `data-entry.html`.
2. Select the tab and switch to **Paste Historical Data**.
3. In your Excel sheet:
   - Find the row for a metric (e.g. Dock to Stock %)
   - Select only the **value cells** (not the label column)
   - Copy (**Ctrl+C**)
4. Back in Data Entry:
   - Select the metric from the dropdown
   - Set the **First Column Date** to the date of your first copied column
   - Set the interval (Daily or Weekly)
   - Paste into the text area
   - Click **Preview**, verify the dates look right
   - Click **Import All**
5. Repeat for each metric.

---

## Step 5 — Daily Updates

1. Go to `data-entry.html` → **Add Today's Data** tab.
2. The date defaults to today. Enter values for each metric.
3. Click **Save All Values**.

---

## Dashboard Usage

- **Customer tabs** across the top switch between different accounts/sites.
- **Day / Week / Month / Year** buttons aggregate data to the selected granularity.
- **From / To** date pickers filter the visible range.
- The **Avg** number in the top-right of each chart shows the overall average across the filtered range, colored green (meeting target) or red (missing target).
- **⛶** button in the top-right enters fullscreen mode (great for TV displays).

---

## Adding More Customers / Tabs

Repeat Step 3 in Setup. Each tab has completely independent metrics and layouts. There is no limit on the number of tabs.

---

## Notes on Storage

- All data is stored in Google Sheets. Each metric gets its own sheet tab (named `data_{tabKey}_{metricKey}`).
- No Firebase is used — no storage limits, no cost.
- The Google Sheets API free tier allows up to **2 million cells** and 100 requests/second, which is far more than needed for this use case.
- Configuration and layouts are saved both in Google Sheets and in `localStorage` for fast offline rendering.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "API URL not configured" | Go to Setup, paste and save your Apps Script URL |
| "Error: Script function not found" | Re-deploy Apps Script as a new deployment |
| Charts show no data | Check that data was imported in Data Entry |
| Changes not reflected | Click ↺ Refresh on the dashboard, or re-deploy Apps Script |
| Layout not saving | Make sure you're logged into the same browser — layout saves in `localStorage` |
