// public/js/reports.js
// ─────────────────────────────────────────────────────────────
// Reports screen — month selector, trend chart, category
// breakdown table, biggest expense callout, CSV export.
//
// CSV EXPORT — HOW IT WORKS:
// The server sends us an array of transaction objects.
// We build a CSV string in JavaScript — comma-separated values
// with a header row. Then we create a Blob (a file-like object
// in memory), create a temporary <a> link pointing to it,
// programmatically click it, then remove it.
// This triggers a file download without any server involvement.
// The entire CSV is generated client-side from the API data.
//
// WHERE ELSE YOU SEE THIS:
// Every "Export" button in a web app works this way —
// Google Sheets exports, bank statement downloads, data
// exports from Notion, Airtable, and similar tools.
// ─────────────────────────────────────────────────────────────

let trendChartInstance = null;

// State
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentTransactions = [];

async function loadReports() {
  renderMonthSelector();
  await Promise.all([
    loadMonthlyReport(),
    loadTrendChart(),
  ]);
}

// ── MONTH SELECTOR ────────────────────────────────────────────
function renderMonthSelector() {
  const el = document.getElementById('month-selector');
  if (!el) return;

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  // Build year options — current year and last 2 years
  const years = [];
  for (let y = currentYear; y >= currentYear - 2; y--) {
    years.push(y);
  }

  el.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap">
      <select id="report-month"
              onchange="onMonthChange()"
              style="padding:9px 14px; background:var(--surface);
                     border:1px solid var(--border-2);
                     border-radius:var(--radius-md);
                     color:var(--text); font-size:13px;
                     font-weight:500; outline:none; cursor:pointer">
        ${months.map((m, i) =>
          `<option value="${i+1}"
                   ${i+1 === currentMonth ? 'selected' : ''}>
             ${m}
           </option>`
        ).join('')}
      </select>
      <select id="report-year"
              onchange="onMonthChange()"
              style="padding:9px 14px; background:var(--surface);
                     border:1px solid var(--border-2);
                     border-radius:var(--radius-md);
                     color:var(--text); font-size:13px;
                     font-weight:500; outline:none; cursor:pointer">
        ${years.map(y =>
          `<option value="${y}"
                   ${y === currentYear ? 'selected' : ''}>
             ${y}
           </option>`
        ).join('')}
      </select>
      <button onclick="exportCSV()"
              class="btn-secondary"
              style="display:flex; align-items:center; gap:6px">
        <i class="ti ti-download" aria-hidden="true"></i>
        Export CSV
      </button>
    </div>
  `;
}

function onMonthChange() {
  currentMonth = parseInt(document.getElementById('report-month').value);
  currentYear  = parseInt(document.getElementById('report-year').value);
  loadMonthlyReport();
}

// ── MONTHLY REPORT ────────────────────────────────────────────
async function loadMonthlyReport() {
  try {
    const data = await api.get(
      `/reports/monthly?year=${currentYear}&month=${currentMonth}`
    );

    currentTransactions = data.transactions;

    // Summary row
    const monthName = new Date(currentYear, currentMonth - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });

    document.getElementById('report-month-title').textContent = monthName;

    document.getElementById('report-income').textContent  = formatKES(data.income);
    document.getElementById('report-expense').textContent = formatKES(data.expenses);
    const netEl = document.getElementById('report-net');
    netEl.textContent  = formatKES(data.net);
    netEl.style.color  = data.net >= 0
      ? 'var(--success)'
      : 'var(--danger)';

    // Biggest expense callout
    renderBiggest(data.biggest);

    // Category breakdown table
    renderCategoryTable(data.categories);

  } catch (err) {
    console.error('Monthly report error:', err.message);
  }
}

function renderBiggest(biggest) {
  const el = document.getElementById('report-biggest');
  if (!el) return;

  if (!biggest) {
    el.innerHTML = `
      <p style="color:var(--text-3); font-size:13px">
        No expenses recorded this month
      </p>`;
    return;
  }

  el.innerHTML = `
    <div style="display:flex; align-items:center;
                justify-content:space-between; gap:16px">
      <div>
        <div style="font-size:11px; font-weight:600;
                    text-transform:uppercase; letter-spacing:0.07em;
                    color:var(--text-3); margin-bottom:6px">
          Biggest expense
        </div>
        <div style="font-size:16px; font-weight:700">
          ${biggest.icon} ${biggest.category}
        </div>
        <div style="font-size:13px; color:var(--text-2); margin-top:2px">
          ${biggest.description || '—'} ·
          ${formatDate(biggest.transaction_date)}
        </div>
      </div>
      <div style="font-size:24px; font-weight:800;
                  color:var(--danger); flex-shrink:0">
        ${formatKES(biggest.amount)}
      </div>
    </div>`;
}

function renderCategoryTable(categories) {
  const tbody = document.getElementById('report-categories-tbody');
  if (!tbody) return;

  if (categories.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <span class="empty-icon">📊</span>
          <p>No data for this month</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = categories.map(c => {
    const hasBudget  = c.budget_limit !== null;
    const variance   = c.variance;
    const varColour  = !hasBudget
      ? 'var(--text-3)'
      : variance >= 0
        ? 'var(--success)'
        : 'var(--danger)';
    const varLabel   = !hasBudget
      ? '—'
      : variance >= 0
        ? `+${formatKES(variance)}`
        : formatKES(variance);

    return `
      <tr>
        <td style="font-weight:500">
          ${c.icon} ${c.category}
        </td>
        <td style="text-align:right; font-weight:600;
                   color:var(--danger)">
          ${formatKES(c.actual)}
        </td>
        <td style="text-align:right; color:var(--text-2)">
          ${hasBudget ? formatKES(c.budget_limit) : '—'}
        </td>
        <td style="text-align:right; color:${varColour};
                   font-weight:600">
          ${varLabel}
        </td>
        <td style="text-align:right; color:var(--text-3)">
          ${c.transactions || 0}
        </td>
      </tr>`;
  }).join('');
}

// ── 6-MONTH TREND CHART ───────────────────────────────────────
async function loadTrendChart() {
  try {
    const trend = await api.get('/reports/trend');

    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;

    if (trendChartInstance) {
      trendChartInstance.destroy();
      trendChartInstance = null;
    }

    if (trend.length === 0) {
      canvas.parentElement.innerHTML = `
        <p class="chart-title">6-month trend</p>
        <div class="empty-state">
          <span class="empty-icon">📈</span>
          <p>Not enough data yet</p>
        </div>`;
      return;
    }

    const ctx = canvas.getContext('2d');
    trendChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: trend.map(t => t.label),
        datasets: [
          {
            label:           'Income',
            data:            trend.map(t => t.income),
            backgroundColor: 'rgba(0, 212, 160, 0.8)',
            borderRadius:    6,
            borderSkipped:   false,
          },
          {
            label:           'Expenses',
            data:            trend.map(t => t.expenses),
            backgroundColor: 'rgba(255, 77, 106, 0.8)',
            borderRadius:    6,
            borderSkipped:   false,
          },
        ],
      },
      options: {
        responsive:         true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: {
              color:    'var(--text-2)',
              padding:  16,
              font:     { size: 12 },
              boxWidth: 12,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx =>
                ` ${ctx.dataset.label}: ${formatKES(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid:  { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: 'var(--text-3)', font: { size: 12 } },
          },
          y: {
            grid:  { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color:    'var(--text-3)',
              font:     { size: 12 },
              callback: v => 'KES ' + (v/1000).toFixed(0) + 'k',
            },
          },
        },
      },
    });

  } catch (err) {
    console.error('Trend chart error:', err.message);
  }
}

// ── CSV EXPORT ────────────────────────────────────────────────
function exportCSV() {
  if (!currentTransactions || currentTransactions.length === 0) {
    showToast('No transactions to export', 'error');
    return;
  }

  // Build CSV header + rows
  const header = ['Type', 'Category', 'Amount (KES)',
                  'Date', 'Description', 'Payment Method'];

  const rows = currentTransactions.map(t => [
    t.type,
    t.category,
    parseFloat(t.amount).toFixed(2),
    t.date,
    t.description || '',
    t.payment_method || '',
  ]);

  // Escape a CSV cell — wrap in quotes if it contains a comma
  const escape = val => {
    const str = String(val);
    return str.includes(',') ? `"${str}"` : str;
  };

  const csvContent = [header, ...rows]
    .map(row => row.map(escape).join(','))
    .join('\n');

  // Create a downloadable file from the string
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  const filename = `campuswallet_${months[currentMonth-1]}_${currentYear}.csv`;

  // Create a temporary link, click it, then remove it
  const link    = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Free the object URL from memory
  URL.revokeObjectURL(url);

  showToast(`Downloaded ${filename} ✓`);
}