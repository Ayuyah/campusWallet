// public/js/expenses.js
// ─────────────────────────────────────────────────────────────
// Handles the Expenses screen: category dropdown, add form,
// expenses table, and delete.
//
// PATTERN: OPTIMISTIC vs PESSIMISTIC UI UPDATES
// There are two ways to update the UI after a form submit:
//
// Pessimistic: wait for the server to respond, then reload
//   all data from scratch. Safe but feels slow.
//
// Optimistic: update the UI immediately, assume success.
//   Fast but can show wrong data if the server rejects.
//
// We use a middle path: wait for server confirmation (safe),
// then prepend the returned row to the table (fast feeling).
// No full reload needed — just insert one row at the top.
// ─────────────────────────────────────────────────────────────

// Called when the Expenses nav item is clicked
async function loadExpenses() {
  await Promise.all([
    loadExpenseCategories(),
    loadExpensesTable(),
  ]);
}

// Populate the category <select> dropdown
async function loadExpenseCategories() {
  try {
    const categories = await api.get('/expenses/categories');
    const select = document.getElementById('exp-category');
    select.innerHTML = categories.map(c =>
      `<option value="${c.category_id}">${c.icon} ${c.name}</option>`
    ).join('');
  } catch (err) {
    console.error('Could not load expense categories:', err.message);
  }
}

// Load and render the expenses table
async function loadExpensesTable() {
  const tbody = document.getElementById('expenses-tbody');
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="empty-state">
        <span class="empty-icon">⏳</span>
        <p>Loading...</p>
      </td>
    </tr>`;

  try {
    const expenses = await api.get('/expenses');
    renderExpensesTable(expenses);
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <span class="empty-icon">❌</span>
          <p>Could not load expenses</p>
        </td>
      </tr>`;
  }
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expenses-tbody');

  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <span class="empty-icon">💸</span>
          <p>No expenses recorded yet — add your first one above</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(e => `
    <tr id="expense-row-${e.expense_id}">
      <td>${formatDate(e.transaction_date)}</td>
      <td>${e.icon} ${e.category}</td>
      <td style="color: var(--color-text-muted)">
        ${e.description || '—'}
      </td>
      <td style="color: var(--color-text-muted)">
        ${e.payment_method}
      </td>
      <td style="text-align:right">
        <span style="font-weight:600; color: var(--color-danger)">
          ${formatKES(e.amount)}
        </span>
        <button
          onclick="deleteExpense(${e.expense_id})"
          style="margin-left:12px; background:transparent; border:none;
                 color: var(--color-text-muted); cursor:pointer;
                 font-size:0.85rem; padding:2px 6px; border-radius:4px;"
          title="Delete this expense">
          ✕
        </button>
      </td>
    </tr>
  `).join('');
}

// Handle the Add Expense form submission
async function submitExpense(e) {
  e.preventDefault();

  const btn = document.getElementById('exp-submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving...';

  const data = {
    category_id:      document.getElementById('exp-category').value,
    amount:           document.getElementById('exp-amount').value,
    transaction_date: document.getElementById('exp-date').value,
    payment_method:   document.getElementById('exp-method').value,
    description:      document.getElementById('exp-description').value.trim(),
  };

  try {
    const newExpense = await api.post('/expenses', data);

    // Reset the form
    document.getElementById('exp-amount').value      = '';
    document.getElementById('exp-description').value = '';
    document.getElementById('exp-date').value        =
      new Date().toISOString().split('T')[0];

    // Prepend the new row to the top of the table
    const tbody = document.getElementById('expenses-tbody');
    const emptyState = tbody.querySelector('.empty-state');
    if (emptyState) {
      tbody.innerHTML = '';
    }

    const newRow = document.createElement('tr');
    newRow.id = `expense-row-${newExpense.expense_id}`;
    newRow.innerHTML = `
      <td>${formatDate(newExpense.transaction_date)}</td>
      <td>${newExpense.icon} ${newExpense.category}</td>
      <td style="color: var(--color-text-muted)">
        ${newExpense.description || '—'}
      </td>
      <td style="color: var(--color-text-muted)">
        ${newExpense.payment_method}
      </td>
      <td style="text-align:right">
        <span style="font-weight:600; color: var(--color-danger)">
          ${formatKES(newExpense.amount)}
        </span>
        <button
          onclick="deleteExpense(${newExpense.expense_id})"
          style="margin-left:12px; background:transparent; border:none;
                 color: var(--color-text-muted); cursor:pointer;
                 font-size:0.85rem; padding:2px 6px; border-radius:4px;"
          title="Delete">✕
        </button>
      </td>
    `;
    tbody.insertBefore(newRow, tbody.firstChild);

    showToast('Expense recorded ✓');

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Record Expense';
  }
}

// Delete an expense row
async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;

  try {
    await api.delete(`/expenses/${id}`);
    const row = document.getElementById(`expense-row-${id}`);
    if (row) row.remove();
    showToast('Expense deleted');
  } catch (err) {
    showToast(err.message, 'error');
  }
}