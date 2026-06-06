// routes/reports.js
const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const protect = require('../middleware/auth');

// GET /api/reports/dashboard-summary
// Returns income total, expense total, and category breakdown
// for a given month — used by the dashboard.
router.get('/dashboard-summary', protect, async (req, res) => {
  const userId = req.session.userId;
  const year   = parseInt(req.query.year)  || new Date().getFullYear();
  const month  = parseInt(req.query.month) || new Date().getMonth() + 1;

  try {
    // Total income for the month
    const [incRows] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM income
       WHERE user_id = ?
         AND YEAR(received_date)  = ?
         AND MONTH(received_date) = ?`,
      [userId, year, month]
    );

    // Total expenses for the month
    const [expRows] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE user_id = ?
         AND YEAR(transaction_date)  = ?
         AND MONTH(transaction_date) = ?`,
      [userId, year, month]
    );

    // Expenses broken down by category
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

    // 5 most recent transactions (expenses + income combined)
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
    console.error('[Reports] Dashboard summary error:', err.message);
    res.status(500).json({ error: 'Could not load dashboard data' });
  }
});

module.exports = router;