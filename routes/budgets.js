// routes/budgets.js
// ─────────────────────────────────────────────────────────────
// Budget endpoints: get all budgets with live progress,
// set or update a budget limit.
//
// THE KEY QUERY — Budget vs Actual:
// We JOIN budgets with expenses to calculate how much has
// been spent this month in each category. This is a LEFT JOIN
// because we want to show ALL expense categories, even ones
// where the user has no budget set yet.
//
// COALESCE(SUM(e.amount), 0):
// If there are no expenses for a category this month,
// SUM returns NULL. COALESCE replaces NULL with 0.
// Without this, a category with no spending would show
// NULL instead of 0 in the results.
//
// WHERE ELSE YOU SEE THIS PATTERN:
// Budget vs actual reporting is one of the most common
// database query patterns in finance apps, ERP systems,
// and accounting software. The JOIN + COALESCE + GROUP BY
// combination is standard SQL you will write repeatedly.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const protect = require('../middleware/auth');

// ── GET ALL BUDGETS WITH LIVE PROGRESS ───────────────────────
// GET /api/budgets
router.get('/', protect, async (req, res) => {
  const userId = req.session.userId;
  const now    = new Date();
  const year   = parseInt(req.query.year)  || now.getFullYear();
  const month  = parseInt(req.query.month) || now.getMonth() + 1;

  try {
    // Get every expense category, with budget limit if set,
    // and actual spending this month
    const [rows] = await pool.execute(
      `SELECT
         ec.category_id,
         ec.name,
         ec.icon,
         b.budget_id,
         b.monthly_limit,
         COALESCE(SUM(e.amount), 0) AS spent
       FROM expense_categories ec
       LEFT JOIN budgets b
         ON b.category_id = ec.category_id
         AND b.user_id = ?
       LEFT JOIN expenses e
         ON e.category_id = ec.category_id
         AND e.user_id = ?
         AND YEAR(e.transaction_date)  = ?
         AND MONTH(e.transaction_date) = ?
       WHERE ec.is_active = 1
       GROUP BY
         ec.category_id, ec.name, ec.icon,
         b.budget_id, b.monthly_limit
       ORDER BY ec.name`,
      [userId, userId, year, month]
    );

    // Calculate percentage and status for each category
    const budgets = rows.map(row => {
      const limit   = row.monthly_limit ? parseFloat(row.monthly_limit) : null;
      const spent   = parseFloat(row.spent);
      const pct     = limit ? Math.round((spent / limit) * 100) : null;

      let status = 'no-budget';
      if (limit !== null) {
        if (pct >= 100)     status = 'over';
        else if (pct >= 75) status = 'warning';
        else                status = 'good';
      }

      return {
        category_id:   row.category_id,
        name:          row.name,
        icon:          row.icon,
        budget_id:     row.budget_id,
        monthly_limit: limit,
        spent,
        remaining:     limit !== null ? limit - spent : null,
        percentage:    pct,
        status,
      };
    });

    res.json(budgets);

  } catch (err) {
    console.error('[Budgets] GET error:', err.message);
    res.status(500).json({ error: 'Could not load budgets' });
  }
});

// ── SET OR UPDATE A BUDGET ────────────────────────────────────
// PUT /api/budgets
// Uses INSERT ... ON DUPLICATE KEY UPDATE — this is called
// an UPSERT. If no budget exists for this category, it inserts.
// If one already exists (hits the UNIQUE KEY), it updates.
// One endpoint handles both create and edit.
router.put('/', protect, async (req, res) => {
  const userId = req.session.userId;
  const { category_id, monthly_limit } = req.body;

  if (!category_id || monthly_limit === undefined) {
    return res.status(400).json({
      error: 'Category and monthly limit are required'
    });
  }

  if (parseFloat(monthly_limit) < 0) {
    return res.status(400).json({
      error: 'Budget limit cannot be negative'
    });
  }

  try {
    await pool.execute(
      `INSERT INTO budgets (user_id, category_id, monthly_limit)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit)`,
      [userId, category_id, parseFloat(monthly_limit)]
    );

    res.json({ message: 'Budget saved' });

  } catch (err) {
    console.error('[Budgets] PUT error:', err.message);
    res.status(500).json({ error: 'Could not save budget' });
  }
});

// ── DELETE A BUDGET ───────────────────────────────────────────
// DELETE /api/budgets/:categoryId
router.delete('/:categoryId', protect, async (req, res) => {
  const userId     = req.session.userId;
  const categoryId = req.params.categoryId;

  try {
    await pool.execute(
      `DELETE FROM budgets
       WHERE user_id = ? AND category_id = ?`,
      [userId, categoryId]
    );
    res.json({ message: 'Budget removed' });
  } catch (err) {
    console.error('[Budgets] DELETE error:', err.message);
    res.status(500).json({ error: 'Could not remove budget' });
  }
});

module.exports = router;