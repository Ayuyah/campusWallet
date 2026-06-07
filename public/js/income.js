// public/js/income.js
// Same structure as expenses.js

async function loadIncome() {
  await Promise.all([
    loadIncomeCategories(),
    loadIncomeTable(),
  ]);
}

async function loadIncomeCategories() {
  try {
    const categories = await api.get('/income/categories');
    const select = document.getElementById('inc-category');
    select.innerHTML = categories.map(c =>
      `<option value="${c.category_id}">${c.name}</option>`
    ).join('');
  } catch (err) {
    console.error('Could not load income categories:', err.message);
  }
}

async function loadIncomeTable() {
  const tbody = document.getElementById('income-tbody');
  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="empty-state">
        <span class="empty-icon">⏳</span>
        <p>Loading...</p>
      </td>
    </tr>`;

  try {
    const records = await api.get('/income');
    renderIncomeTable(records);
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <span class="empty-icon">❌</span>
          <p>Could not load income</p>
        </td>
      </tr>`;
  }
}

function renderIncomeTable(records) {
  const tbody = document.getElementById('income-tbody');

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <span class="empty-icon">💰</span>
          <p>No income recorded yet — add your first entry above</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr id="income-row-${r.income_id}">
      <td>${formatDate(r.received_date)}</td>
      <td>${r.category}
        ${r.is_recurring
          ? '<span style="font-size:0.75rem; color:var(--color-accent); margin-left:6px">↻ recurring</span>'
          : ''}
      </td>
      <td style="color: var(--color-text-muted)">
        ${r.description || '—'}
      </td>
      <td style="text-align:right">
        <span style="font-weight:600; color: var(--color-success)">
          ${formatKES(r.amount)}
        </span>
        <button
          onclick="deleteIncome(${r.income_id})"
          style="margin-left:12px; background:transparent; border:none;
                 color: var(--color-text-muted); cursor:pointer;
                 font-size:0.85rem; padding:2px 6px; border-radius:4px;"
          title="Delete">✕
        </button>
      </td>
    </tr>
  `).join('');
}

async function submitIncome(e) {
  e.preventDefault();

  const btn = document.getElementById('inc-submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving...';

  const data = {
    category_id:   document.getElementById('inc-category').value,
    amount:        document.getElementById('inc-amount').value,
    received_date: document.getElementById('inc-date').value,
    description:   document.getElementById('inc-description').value.trim(),
    is_recurring:  document.getElementById('inc-recurring').checked,
  };

  try {
    const newRecord = await api.post('/income', data);

    document.getElementById('inc-amount').value      = '';
    document.getElementById('inc-description').value = '';
    document.getElementById('inc-date').value        =
      new Date().toISOString().split('T')[0];
    document.getElementById('inc-recurring').checked = false;

    const tbody = document.getElementById('income-tbody');
    const emptyState = tbody.querySelector('.empty-state');
    if (emptyState) tbody.innerHTML = '';

    const newRow = document.createElement('tr');
    newRow.id = `income-row-${newRecord.income_id}`;
    newRow.innerHTML = `
      <td>${formatDate(newRecord.received_date)}</td>
      <td>${newRecord.category}</td>
      <td style="color: var(--color-text-muted)">
        ${newRecord.description || '—'}
      </td>
      <td style="text-align:right">
        <span style="font-weight:600; color: var(--color-success)">
          ${formatKES(newRecord.amount)}
        </span>
        <button
          onclick="deleteIncome(${newRecord.income_id})"
          style="margin-left:12px; background:transparent; border:none;
                 color: var(--color-text-muted); cursor:pointer;
                 font-size:0.85rem; padding:2px 6px; border-radius:4px;"
          title="Delete">✕
        </button>
      </td>
    `;
    tbody.insertBefore(newRow, tbody.firstChild);

    showToast('Income recorded ✓');

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Record Income';
  }
}

async function deleteIncome(id) {
  if (!confirm('Delete this income record?')) return;

  try {
    await api.delete(`/income/${id}`);
    const row = document.getElementById(`income-row-${id}`);
    if (row) row.remove();
    showToast('Income record deleted');
  } catch (err) {
    showToast(err.message, 'error');
  }
}