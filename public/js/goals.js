// public/js/goals.js
// ─────────────────────────────────────────────────────────────
// Saving goals screen — create goals, contribute, mark complete.
//
// THE MODAL PATTERN:
// Instead of navigating to a new page to add a contribution,
// we show a modal dialog — a panel that appears over the current
// page. The user fills it in and dismisses it.
// This keeps the user in context rather than losing their place.
// Modals are used for short focused tasks: confirm, quick-add,
// contribute. They are not good for long forms.
// ─────────────────────────────────────────────────────────────

async function loadGoals() {
  const container = document.getElementById('goals-container');
  container.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">⏳</span>
      <p>Loading goals...</p>
    </div>`;

  try {
    const goals = await api.get('/goals');
    renderGoals(goals);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">❌</span>
        <p>Could not load goals</p>
      </div>`;
  }
}

function renderGoals(goals) {
  const container = document.getElementById('goals-container');

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 40px">
        <i class="ti ti-star empty-icon" style="font-size:40px;color:var(--text-3)"></i>
        <p style="margin-top:12px;font-size:15px">No saving goals yet</p>
        <p style="font-size:13px;color:var(--text-3);margin-top:4px">
          Create your first goal — laptop, fees, a trip, anything
        </p>
      </div>`;
    return;
  }

  const active    = goals.filter(g => !g.is_complete);
  const completed = goals.filter(g =>  g.is_complete);

  let html = '';

  if (active.length > 0) {
    html += `<div class="goals-list">`;
    active.forEach(g => { html += renderGoalCard(g); });
    html += `</div>`;
  }

  if (completed.length > 0) {
    html += `
      <h3 style="margin: var(--space-lg) 0 var(--space-md);
                 font-size: 13px; font-weight: 600;
                 color: var(--text-3); text-transform: uppercase;
                 letter-spacing: 0.07em">
        Completed
      </h3>
      <div class="goals-list">`;
    completed.forEach(g => { html += renderGoalCard(g); });
    html += `</div>`;
  }

  container.innerHTML = html;
}

function renderGoalCard(g) {
  const daysLeft = g.target_date
    ? Math.ceil((new Date(g.target_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const daysLabel = g.target_date
    ? (daysLeft < 0
        ? `<span style="color:var(--danger)">
             ${Math.abs(daysLeft)} days overdue
           </span>`
        : daysLeft === 0
          ? `<span style="color:var(--warning)">Due today</span>`
          : `${daysLeft} days left`)
    : 'No deadline';

  return `
    <div class="goal-card ${g.is_complete ? 'complete' : ''}"
         id="goal-card-${g.goal_id}">
      <div class="goal-card-header">
        <div>
          <div class="goal-name">
            ${g.is_complete ? '✓ ' : ''}${g.name}
          </div>
          <div class="goal-target-date">${daysLabel}</div>
          ${g.description
            ? `<div style="font-size:12px;color:var(--text-3);margin-top:4px">
                 ${g.description}
               </div>`
            : ''}
        </div>
        <div class="goal-amounts">
          <div class="goal-saved">${formatKES(g.saved_amount)}</div>
          <div class="goal-target">of ${formatKES(g.target_amount)}</div>
        </div>
      </div>

      <div class="goal-bar-track">
        <div class="goal-bar-fill"
             style="width: ${g.percentage}%">
        </div>
      </div>

      <div style="display:flex; justify-content:space-between;
                  margin-bottom: var(--space-md)">
        <span style="font-size:12px; color:var(--text-3)">
          ${g.percentage}% saved
        </span>
        <span style="font-size:12px; color:var(--text-3)">
          ${g.is_complete ? 'Goal reached!' : formatKES(g.remaining) + ' to go'}
        </span>
      </div>

      ${!g.is_complete ? `
        <div class="goal-actions">
          <button class="btn-contribute"
                  onclick="openContributeModal(${g.goal_id}, '${g.name}', ${g.remaining})">
            <i class="ti ti-plus" aria-hidden="true"></i>
            Add contribution
          </button>
          <button class="btn-complete-goal"
                  onclick="markGoalComplete(${g.goal_id})">
            <i class="ti ti-check" aria-hidden="true"></i>
            Mark complete
          </button>
          <button onclick="deleteGoal(${g.goal_id})"
                  style="padding:9px 12px; background:transparent;
                         border:1px solid var(--border-2);
                         border-radius:var(--radius-pill);
                         color:var(--text-3); cursor:pointer;
                         font-size:13px; transition:all 0.15s">
            <i class="ti ti-trash" aria-hidden="true"></i>
          </button>
        </div>` : `
        <div style="font-size:13px; color:var(--success); font-weight:600">
          <i class="ti ti-circle-check" aria-hidden="true"></i>
          Completed on ${formatDate(g.updated_at || g.created_at)}
        </div>`}
    </div>`;
}

// ── CONTRIBUTE MODAL ──────────────────────────────────────────
function openContributeModal(goalId, goalName, remaining) {
  // Remove any existing modal
  const existing = document.getElementById('contribute-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'contribute-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 500;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--surface);
      border: 1px solid var(--border-2);
      border-radius: var(--radius-xl);
      padding: 32px;
      width: 100%; max-width: 400px;
      animation: slideUp 0.25s var(--ease-spring);
    ">
      <h3 style="font-size:18px; font-weight:700;
                 letter-spacing:-0.3px; margin-bottom:6px">
        Add contribution
      </h3>
      <p style="font-size:13px; color:var(--text-2); margin-bottom:24px">
        ${goalName}
        ${remaining > 0
          ? ` · ${formatKES(remaining)} remaining`
          : ''}
      </p>
      <div class="form-group" style="margin-bottom:20px">
        <label>Amount (KES)</label>
        <input type="number" id="contribute-amount"
               min="1" step="1" placeholder="0"
               style="font-size:20px; font-weight:700;
                      text-align:center; padding:16px">
      </div>
      <div style="display:flex; gap:10px">
        <button onclick="submitContribution(${goalId})"
                class="btn-primary" style="flex:1; justify-content:center">
          Save
        </button>
        <button onclick="document.getElementById('contribute-modal').remove()"
                class="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  `;

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);

  // Focus the input
  setTimeout(() => {
    document.getElementById('contribute-amount')?.focus();
  }, 100);
}

async function submitContribution(goalId) {
  const amount = document.getElementById('contribute-amount')?.value;

  if (!amount || parseFloat(amount) <= 0) {
    showToast('Enter a valid amount', 'error');
    return;
  }

  try {
    const updated = await api.post(`/goals/${goalId}/contribute`, {
      amount: parseFloat(amount)
    });

    document.getElementById('contribute-modal')?.remove();
    showToast('Contribution added ✓');

    // Update the card in place
    const card = document.getElementById(`goal-card-${goalId}`);
    if (card) {
      card.outerHTML = renderGoalCard(updated);
    }

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function markGoalComplete(goalId) {
  if (!confirm('Mark this goal as complete?')) return;

  try {
    await api.put(`/goals/${goalId}/complete`);
    showToast('Goal completed! 🎉');
    loadGoals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteGoal(goalId) {
  if (!confirm('Delete this goal? This cannot be undone.')) return;

  try {
    await api.delete(`/goals/${goalId}`);
    const card = document.getElementById(`goal-card-${goalId}`);
    if (card) card.remove();
    showToast('Goal deleted');
  } catch (err) {
    showToast(err.message, 'error');
  }
}