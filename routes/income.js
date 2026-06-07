// routes/income.js
// Same structure as expenses.js — read that file's comments
// for the explanations. The pattern is identical.

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const protect = require('../middleware/auth');

// ── GET ALL INCOME ────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  const userId = req.session.userId;
  const { month, year } = req.query;

  try {
    let query = `
      SELECT
        i.income_id,
        ic.name        AS category,
        i.amount,
        i.received_date,
        i.description,
        i.is_recurring,
        i.created_at
      FROM income i
      JOIN income_categories ic ON i.category_id = ic.category_id
      WHERE i.user_id = ?`;

    const params = [userId];

    if (year)  { query += ' AND YEAR(i.received_date)  = ?'; params.push(year); }
    if (month) { query += ' AND MONTH(i.received_date) = ?'; params.push(month); }

    query += ' ORDER BY i.received_date DESC, i.created_at DESC LIMIT 100';

    const [rows] = await pool.execute(query, params);
    res.json(rows);

  } catch (err) {
    console.error('[Income] GET error:', err.message);
    res.status(500).json({ error: 'Could not load income' });
  }
});

// ── GET CATEGORIES ────────────────────────────────────────────
router.get('/categories', protect, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT category_id, name
       FROM income_categories
       WHERE is_active = 1
       ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error('[Income] Categories error:', err.message);
    res.status(500).json({ error: 'Could not load categories' });
  }
});

// ── ADD INCOME ────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  const userId = req.session.userId;
  const { category_id, amount, received_date,
          description, is_recurring } = req.body;

  if (!category_id || !amount || !received_date) {
    return res.status(400).json({
      error: 'Category, amount and date are required'
    });
  }

  if (parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO income
         (user_id, category_id, amount, received_date, description, is_recurring)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        category_id,
        parseFloat(amount),
        received_date,
        description || null,
        is_recurring ? 1 : 0,
      ]
    );

    const [rows] = await pool.execute(
      `SELECT
         i.income_id, ic.name AS category,
         i.amount, i.received_date, i.description, i.is_recurring
       FROM income i
       JOIN income_categories ic ON i.category_id = ic.category_id
       WHERE i.income_id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);

  } catch (err) {
    console.error('[Income] POST error:', err.message);
    res.status(500).json({ error: 'Could not save income' });
  }
});

// ── DELETE INCOME ─────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  const userId   = req.session.userId;
  const incomeId = req.params.id;

  try {
    const [result] = await pool.execute(
      `DELETE FROM income
       WHERE income_id = ? AND user_id = ?`,
      [incomeId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Income record not found' });
    }

    res.json({ message: 'Income record deleted' });

  } catch (err) {
    console.error('[Income] DELETE error:', err.message);
    res.status(500).json({ error: 'Could not delete income record' });
  }
});

module.exports = router;