// routes/reports.js
// ─────────────────────────────────────────────────────────────
// Reports: dashboard summary, monthly detail, 6-month trend,
// category breakdown, and CSV export.
//
// THE UNION ALL PATTERN:
// The 6-month trend query needs income AND expenses in one
// result set so we can compare them side by side per month.
// We use UNION ALL to combine two separate SELECT statements
// into one result set.
//
// UNION vs UNION ALL:
// UNION removes duplicates — slower, scans both result sets.
// UNION ALL keeps everything — faster, no dedup scan needed.
// Since income and expenses can never be duplicates of each
// other (different tables, different types), UNION ALL is
// always correct here.
//
// DATE_FORMAT(date, '%Y-%m'):
// Groups rows by year-month: '2024-01', '2024-02' etc.
// This is more reliable than grouping by MONTH() alone
// because MONTH() would merge January 2024 and January 2025.
//
// WHERE ELSE YOU SEE THIS:
// Financial trend charts in every analytics dashboard — Google
// Analytics, Stripe, bank apps — use exactly this pattern:
// aggregate by time period, compare two metrics side by side.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const protect = require('../middleware/auth');

// ── DASHBOARD SUMMARY ─────────────────────────────────────────
// GET /api/reports/dashboard-summary
router.get('/dashboard-summary', protect, async (req, res) => {
  const userId = req.session.userId;
  const year   = parseInt(req.query.year)  || new Date().getFullYear();
  const month  = parseInt(req.query.month) || new Date().getMonth() + 1;

  try {
    const [incRows] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM income
       WHERE user_id = ?
         AND YEAR(received_date)  = ?
         AND MONTH(received_date) = ?`,
      [userId, year, month]
    );

    const [expRows] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE user_id = ?
         AND YEAR(transaction_date)  = ?
         AND MONTH(transaction_date) = ?`,
      [userId, year, month]
    );

    const [catRows] = await pool.execute(
      `SELECT
         ec.name AS category,
         ec.icon,
         SUM(e.amount) AS total
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.category_id
       WHERE e.user_id = ?
         AND YEAR(e.transaction_date)  = ?
         AND MONTH(e.transaction_date) = ?
       GROUP BY ec.category_id, ec.name, ec.icon
       ORDER BY total DESC`,
      [userId, year, month]
    );

    const [recentRows] = await pool.execute(
      `SELECT 'expense' AS type, ec.name AS category, ec.icon,
              e.amount, e.transaction_date AS date, e.description
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.category_id
       WHERE e.user_id = ?
       UNION ALL
       SELECT 'income' AS type, ic.name AS category, '💰' AS icon,
              i.amount, i.received_date AS date, i.description
       FROM income i
       JOIN income_categories ic ON i.category_id = ic.category_id
       WHERE i.user_id = ?
       ORDER BY date DESC
       LIMIT 5`,
      [userId, userId]
    );

    res.json({
      income:     parseFloat(incRows[0].total),
      expenses:   parseFloat(expRows[0].total),
      net:        parseFloat(incRows[0].total) - parseFloat(expRows[0].total),
      categories: catRows,
      recent:     recentRows,
    });

  } catch (err) {
    console.error('[Reports] Dashboard error:', err.message);
    res.status(500).json({ error: 'Could not load dashboard data' });
  }
});

// ── MONTHLY DETAIL ────────────────────────────────────────────
// GET /api/reports/monthly?year=2024&month=1
router.get('/monthly', protect, async (req, res) => {
  const userId = req.session.userId;
  const year   = parseInt(req.query.year)  || new Date().getFullYear();
  const month  = parseInt(req.query.month) || new Date().getMonth() + 1;

  try {
    // Income total
    const [incRows] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM income
       WHERE user_id = ?
         AND YEAR(received_date)  = ?
         AND MONTH(received_date) = ?`,
      [userId, year, month]
    );

    // Expense total
    const [expRows] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE user_id = ?
         AND YEAR(transaction_date)  = ?
         AND MONTH(transaction_date) = ?`,
      [userId, year, month]
    );

    // Category breakdown with budget comparison
    const [catBreakdown] = await pool.execute(
      `SELECT
         ec.name          AS category,
         ec.icon,
         COUNT(e.expense_id)   AS transactions,
         SUM(e.amount)         AS actual,
         b.monthly_limit       AS budget_limit
       FROM expense_categories ec
       LEFT JOIN expenses e
         ON e.category_id = ec.category_id
         AND e.user_id = ?
         AND YEAR(e.transaction_date)  = ?
         AND MONTH(e.transaction_date) = ?
       LEFT JOIN budgets b
         ON b.category_id = ec.category_id
         AND b.user_id = ?
       WHERE ec.is_active = 1
       GROUP BY ec.category_id, ec.name, ec.icon, b.monthly_limit
       HAVING actual > 0 OR b.monthly_limit IS NOT NULL
       ORDER BY actual DESC`,
      [userId, year, month, userId]
    );

    // Biggest single expense
    const [biggestRows] = await pool.execute(
      `SELECT e.amount, e.description, e.transaction_date,
              ec.name AS category, ec.icon
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.category_id
       WHERE e.user_id = ?
         AND YEAR(e.transaction_date)  = ?
         AND MONTH(e.transaction_date) = ?
       ORDER BY e.amount DESC
       LIMIT 1`,
      [userId, year, month]
    );

    // All transactions for CSV export
    const [allTransactions] = await pool.execute(
      `SELECT
         'Expense'            AS type,
         ec.name              AS category,
         e.amount,
         e.transaction_date   AS date,
         e.description,
         e.payment_method
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.category_id
       WHERE e.user_id = ?
         AND YEAR(e.transaction_date)  = ?
         AND MONTH(e.transaction_date) = ?
       UNION ALL
       SELECT
         'Income'             AS type,
         ic.name              AS category,
         i.amount,
         i.received_date      AS date,
         i.description,
         NULL                 AS payment_method
       FROM income i
       JOIN income_categories ic ON i.category_id = ic.category_id
       WHERE i.user_id = ?
         AND YEAR(i.received_date)  = ?
         AND MONTH(i.received_date) = ?
       ORDER BY date DESC`,
      [userId, year, month, userId, year, month]
    );

    res.json({
      year,
      month,
      income:       parseFloat(incRows[0].total),
      expenses:     parseFloat(expRows[0].total),
      net:          parseFloat(incRows[0].total) - parseFloat(expRows[0].total),
      categories:   catBreakdown.map(c => ({
        ...c,
        actual:       parseFloat(c.actual || 0),
        budget_limit: c.budget_limit ? parseFloat(c.budget_limit) : null,
        variance:     c.budget_limit
          ? parseFloat(c.budget_limit) - parseFloat(c.actual || 0)
          : null,
      })),
      biggest:      biggestRows[0] || null,
      transactions: allTransactions,
    });

  } catch (err) {
    console.error('[Reports] Monthly error:', err.message);
    res.status(500).json({ error: 'Could not load monthly report' });
  }
});

// ── 6-MONTH TREND ─────────────────────────────────────────────
// GET /api/reports/trend
router.get('/trend', protect, async (req, res) => {
  const userId = req.session.userId;

  try {
    // Get income by month for last 6 months
    const [incTrend] = await pool.execute(
      `SELECT
         DATE_FORMAT(received_date, '%Y-%m') AS month,
         SUM(amount) AS total
       FROM income
       WHERE user_id = ?
         AND received_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(received_date, '%Y-%m')
       ORDER BY month ASC`,
      [userId]
    );

    // Get expenses by month for last 6 months
    const [expTrend] = await pool.execute(
      `SELECT
         DATE_FORMAT(transaction_date, '%Y-%m') AS month,
         SUM(amount) AS total
       FROM expenses
       WHERE user_id = ?
         AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
       ORDER BY month ASC`,
      [userId]
    );

    // Build a unified month list with both values
    // Some months may have income but no expenses, or vice versa
    const monthMap = {};

    incTrend.forEach(row => {
      monthMap[row.month] = {
        month:    row.month,
        income:   parseFloat(row.total),
        expenses: 0,
      };
    });

    expTrend.forEach(row => {
      if (monthMap[row.month]) {
        monthMap[row.month].expenses = parseFloat(row.total);
      } else {
        monthMap[row.month] = {
          month:    row.month,
          income:   0,
          expenses: parseFloat(row.total),
        };
      }
    });

    // Sort by month and format the label
    const trend = Object.values(monthMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        label: new Date(m.month + '-01')
          .toLocaleString('default', { month: 'short', year: '2-digit' }),
      }));

    res.json(trend);

  } catch (err) {
    console.error('[Reports] Trend error:', err.message);
    res.status(500).json({ error: 'Could not load trend data' });
  }
});

module.exports = router;