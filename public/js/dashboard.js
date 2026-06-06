// public/js/dashboard.js
// Fetches summary data from the API and renders the dashboard.

let chartInstance = null;

async function loadDashboard() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // Update the subtitle with the current month name
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  document.getElementById('dash-subtitle').textContent =
    `Summary for ${monthName}`;

  try {
    const data = await api.get(
      `/reports/dashboard-summary?year=${year}&month=${month}`
    );

    // ── SUMMARY CARDS ──────────────────────────────────────
    document.getElementById('dash-income').textContent  = formatKES(data.income);
    document.getElementById('dash-expense').textContent = formatKES(data.expenses);

    const netEl = document.getElementById('dash-net');
    netEl.textContent = formatKES(data.net);
    netEl.className   = `card-value net ${data.net >= 0 ? 'positive' : 'negative'}`;

    // ── CATEGORY CHART ─────────────────────────────────────
    renderCategoryChart(data.categories);

    // ── RECENT TRANSACTIONS ────────────────────────────────
    renderRecentTransactions(data.recent);

  } catch (err) {
    console.error('Dashboard load error:', err.message);
  }
}

function renderCategoryChart(categories) {
  const canvas = document.getElementById('category-chart');
  if (!canvas) return;

  // Destroy previous chart instance before creating a new one
  // (prevents duplicate charts when navigating back to dashboard)
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (categories.length === 0) {
    canvas.parentElement.innerHTML =
      `<div class="chart-title">Spending by Category</div>
       <div class="empty-state">
         <span class="empty-icon">📊</span>
         <p>No expenses recorded this month yet</p>
       </div>`;
    return;
  }

  const colours = [
    '#2563EB','#0D9488','#7C3AED','#B45309','#B91C1C',
    '#15803D','#0369A1','#6D28D9','#92400E','#1E40AF',
    '#065F46','#831843',
  ];

  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   categories.map(c => `${c.icon} ${c.category}`),
      datasets: [{
        data:            categories.map(c => c.total),
        backgroundColor: colours.slice(0, categories.length),
        borderWidth:     0,
        hoverOffset:     8,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color:     '#94A3B8',
            padding:   16,
            font:      { size: 12 },
            boxWidth:  12,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatKES(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

function renderRecentTransactions(transactions) {
  const tbody = document.getElementById('recent-tbody');
  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <span class="empty-icon">📋</span>
          <p>No transactions yet — record your first expense or income</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = transactions.map(t => `
    <tr>
      <td>${t.icon} ${t.category}</td>
      <td style="color: var(--color-text-muted)">${t.description || '—'}</td>
      <td style="color: var(--color-text-muted)">${formatDate(t.date)}</td>
      <td style="text-align: right; font-weight: 600;
                 color: ${t.type === 'income'
                   ? 'var(--color-success)'
                   : 'var(--color-danger)'}">
        ${t.type === 'income' ? '+' : '-'}${formatKES(t.amount)}
      </td>
    </tr>
  `).join('');
}