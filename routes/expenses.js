// routes/expenses.js
// ─────────────────────────────────────────────────────────────
// Handles all expense-related endpoints.
//
// WHAT IS `protect` MIDDLEWARE?
// Every route here imports and uses the `protect` middleware.
// This means before any of these route handlers run, the
// middleware checks: is there a valid session? If not, it
// returns 401 immediately and the route handler never runs.
// This is how we ensure only logged-in users can access data.
//
// WHAT ARE PARAMETERISED QUERIES?  (the ? placeholders)
// Never put user input directly into SQL strings like:
//   `SELECT * FROM expenses WHERE user_id = ${userId}`
// This is called SQL injection — an attacker can manipulate
// the query by typing SQL code into a form field.
// Parameterised queries send the SQL and the values separately.
// The database treats the values as pure data, never as code.
// This is the single most important database security practice.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const protect = require('../middleware/auth');

// ── GET ALL EXPENSES ──────────────────────────────────────────
// GET /api/expenses
router.get('/', protect, async (req, res) => {
  const userId = req.session.userId;

  // Optional filters from query string
  // e.g. /api/expenses?month=1&year=2024&category=2
  const { month, year, category } = req.query;

  try {
    let query = `
      SELECT
        e.expense_id,
        ec.name          AS category,
        ec.icon,
        e.amount,
        e.transaction_date,
        e.description,
        e.payment_method,
        e.created_at
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.category_id
      WHERE e.user_id = ?`;

    const params = [userId];

    // Dynamically add filters only if they were provided
    // This keeps one endpoint flexible instead of writing
    // separate endpoints for every filter combination
    if (year)     { query += ' AND YEAR(e.transaction_date)  = ?'; params.push(year); }
    if (month)    { query += ' AND MONTH(e.transaction_date) = ?'; params.push(month); }
    if (category) { query += ' AND e.category_id = ?';             params.push(category); }

    query += ' ORDER BY e.transaction_date DESC, e.created_at DESC LIMIT 100';

    const [rows] = await pool.execute(query, params);
    res.json(rows);

  } catch (err) {
    console.error('[Expenses] GET error:', err.message);
    res.status(500).json({ error: 'Could not load expenses' });
  }
});

// ── GET CATEGORIES ────────────────────────────────────────────
// GET /api/expenses/categories
// Frontend calls this to populate the category dropdown
router.get('/categories', protect, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT category_id, name, icon
       FROM expense_categories
       WHERE is_active = 1
       ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error('[Expenses] Categories error:', err.message);
    res.status(500).json({ error: 'Could not load categories' });
  }
});

// ── ADD EXPENSE ───────────────────────────────────────────────
// POST /api/expenses
router.post('/', protect, async (req, res) => {
  const userId = req.session.userId;
  const { category_id, amount, transaction_date,
          description, payment_method } = req.body;

  // Validate required fields
  if (!category_id || !amount || !transaction_date) {
    return res.status(400).json({
      error: 'Category, amount and date are required'
    });
  }

  if (parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO expenses
         (user_id, category_id, amount, transaction_date, description, payment_method)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        category_id,
        parseFloat(amount),
        transaction_date,
        description || null,
        payment_method || 'Mobile Money',
      ]
    );

    // Return the newly created expense with its category details
    const [rows] = await pool.execute(
      `SELECT
         e.expense_id, ec.name AS category, ec.icon,
         e.amount, e.transaction_date, e.description, e.payment_method
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.category_id
       WHERE e.expense_id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);

  } catch (err) {
    console.error('[Expenses] POST error:', err.message);
    res.status(500).json({ error: 'Could not save expense' });
  }
});

// ── DELETE EXPENSE ────────────────────────────────────────────
// DELETE /api/expenses/:id
router.delete('/:id', protect, async (req, res) => {
  const userId    = req.session.userId;
  const expenseId = req.params.id;

  try {
    // The WHERE clause includes user_id — this ensures a user
    // can only delete their own expenses, never someone else's
    const [result] = await pool.execute(
      `DELETE FROM expenses
       WHERE expense_id = ? AND user_id = ?`,
      [expenseId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted' });

  } catch (err) {
    console.error('[Expenses] DELETE error:', err.message);
    res.status(500).json({ error: 'Could not delete expense' });
  }
});

module.exports = router;