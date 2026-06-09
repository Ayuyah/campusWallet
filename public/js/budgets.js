// public/js/budgets.js
// ─────────────────────────────────────────────────────────────
// Renders the budgets screen — progress bars, inline editing.
//
// INLINE EDITING PATTERN:
// When the user clicks a budget amount, we replace the
// displayed text with an <input> field on the spot.
// When they press Enter or click away (blur), we save it.
// This avoids a separate "edit" screen for simple value changes.
// You see this pattern in Notion, Trello, and Google Sheets.
// ─────────────────────────────────────────────────────────────

async function loadBudgets() {
  const container = document.getElementById('budgets-container');
  container.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">⏳</span>
      <p>Loading budgets...</p>
    </div>`;

  try {
    const budgets = await api.get('/budgets');
    renderBudgets(budgets);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">❌</span>
        <p>Could not load budgets</p>
      </div>`;
  }
}

function renderBudgets(budgets) {
  const container = document.getElementById('budgets-container');

  // Separate into: budgets set vs no budget yet
  const withBudget    = budgets.filter(b => b.monthly_limit !== null);
  const withoutBudget = budgets.filter(b => b.monthly_limit === null);

  let html = '';

  if (withBudget.length > 0) {
    html += `<div class="budget-list">`;
    withBudget.forEach(b => {
      html += renderBudgetCard(b);
    });
    html += `</div>`;
  }

  // Categories with no budget — show as a simple add-budget list
  if (withoutBudget.length > 0) {
    html += `
      <h3 style="margin: var(--space-lg) 0 var(--space-md);
                 font-size: var(--text-base);
                 color: var(--color-text-muted)">
        No budget set
      </h3>
      <div class="budget-list no-budget-list">`;
    withoutBudget.forEach(b => {
      html += renderBudgetCard(b);
    });
    html += `</div>`;
  }

  if (html === '') {
    html = `
      <div class="empty-state">
        <span class="empty-icon">🎯</span>
        <p>No categories found</p>
      </div>`;
  }

  container.innerHTML = html;
}

function renderBudgetCard(b) {
  const hasBudget = b.monthly_limit !== null;
  const pct       = hasBudget ? Math.min(b.percentage, 100) : 0;

  // Progress bar colour based on status
  const barColour = {
    good:       'var(--color-success)',
    warning:    'var(--color-warning)',
    over:       'var(--color-danger)',
    'no-budget':'var(--color-border)',
  }[b.status] || 'var(--color-border)';

  const limitDisplay = hasBudget
    ? `<span class="budget-limit"
             onclick="editBudgetLimit(${b.category_id}, ${b.monthly_limit})"
             title="Click to edit"
             style="cursor:pointer; text-decoration: underline dotted;">
         ${formatKES(b.monthly_limit)}
       </span>`
    : `<button class="btn-set-budget"
               onclick="editBudgetLimit(${b.category_id}, 0)">
         + Set budget
       </button>`;

  return `
    <div class="budget-card" id="budget-card-${b.category_id}">
      <div class="budget-card-header">
        <span class="budget-category">
          ${b.icon} ${b.name}
        </span>
        <div class="budget-amounts">
          <span style="color: var(--color-text-muted); font-size: var(--text-sm)">
            ${hasBudget ? `${formatKES(b.spent)} of ` : ''}
          </span>
          ${limitDisplay}
          ${hasBudget && b.status === 'over'
            ? `<span style="color:var(--color-danger);
                            font-size:var(--text-sm);
                            margin-left:var(--space-sm)">
                 ⚠️ Over by ${formatKES(Math.abs(b.remaining))}
               </span>`
            : ''}
        </div>
      </div>

      ${hasBudget ? `
        <div class="budget-bar-track">
          <div class="budget-bar-fill"
               style="width: ${pct}%; background: ${barColour}">
          </div>
        </div>
        <div class="budget-bar-labels">
          <span style="color: var(--color-text-muted); font-size: 0.78rem">
            ${b.percentage}% used
          </span>
          ${b.remaining >= 0
            ? `<span style="color: var(--color-text-muted); font-size: 0.78rem">
                 ${formatKES(b.remaining)} remaining
               </span>`
            : ''}
        </div>` : ''}
    </div>`;
}

// Inline edit: replace limit display with an input field
function editBudgetLimit(categoryId, currentLimit) {
  const card = document.getElementById(`budget-card-${categoryId}`);
  if (!card) return;

  // Find the clickable limit span or the set-budget button
  const target = card.querySelector('.budget-limit') ||
                 card.querySelector('.btn-set-budget');
  if (!target) return;

  const input = document.createElement('input');
  input.type        = 'number';
  input.min         = '0';
  input.step        = '100';
  input.value       = currentLimit || '';
  input.placeholder = 'Enter limit';
  input.style.cssText = `
    width: 130px; padding: 4px 8px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--text-sm);
    outline: none;
  `;

  target.replaceWith(input);
  input.focus();
  input.select();

  // Save on Enter key
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await saveBudgetLimit(categoryId, input.value);
    }
    if (e.key === 'Escape') {
      loadBudgets(); // cancel — reload original state
    }
  });

  // Save on click away
  input.addEventListener('blur', async () => {
    await saveBudgetLimit(categoryId, input.value);
  });
}

async function saveBudgetLimit(categoryId, value) {
  const limit = parseFloat(value);

  if (isNaN(limit) || limit < 0) {
    showToast('Enter a valid amount', 'error');
    loadBudgets();
    return;
  }

  try {
    await api.put('/budgets', {
      category_id:   categoryId,
      monthly_limit: limit,
    });
    showToast('Budget saved ✓');
    loadBudgets(); // reload to show updated progress bar
  } catch (err) {
    showToast(err.message, 'error');
    loadBudgets();
  }
}