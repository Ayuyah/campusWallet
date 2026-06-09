// routes/goals.js
// ─────────────────────────────────────────────────────────────
// Saving goals: create, list, contribute, mark complete, delete.
//
// THE CONTRIBUTION PATTERN:
// When a user adds a contribution, we do not create a separate
// "contributions" table. We UPDATE saving_goals.saved_amount
// directly by adding to it. This keeps the schema simple for v1.
//
// SQL: UPDATE saving_goals
//      SET saved_amount = saved_amount + ?
//      WHERE goal_id = ? AND user_id = ?
//
// saved_amount + ? means "take the current value and add to it"
// This is an atomic operation — safe even if two requests hit
// the database at the same time (no race condition).
//
// WHERE ELSE YOU SEE THIS PATTERN:
// Incrementing a counter atomically is one of the most common
// database patterns: likes, view counts, stock quantities,
// wallet balances. Always use += in SQL rather than:
//   1. read the value
//   2. add in application code
//   3. write back
// That three-step approach has a race condition. One SQL
// statement does not.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const protect = require('../middleware/auth');

// ── GET ALL GOALS ─────────────────────────────────────────────
// GET /api/goals
router.get('/', protect, async (req, res) => {
  const userId = req.session.userId;

  try {
    const [rows] = await pool.execute(
      `SELECT
         goal_id,
         name,
         target_amount,
         saved_amount,
         target_date,
         description,
         is_complete,
         created_at
       FROM saving_goals
       WHERE user_id = ?
       ORDER BY is_complete ASC, created_at DESC`,
      [userId]
    );

    // Calculate progress percentage for each goal
    const goals = rows.map(g => ({
      ...g,
      target_amount: parseFloat(g.target_amount),
      saved_amount:  parseFloat(g.saved_amount),
      percentage:    g.target_amount > 0
        ? Math.min(Math.round((g.saved_amount / g.target_amount) * 100), 100)
        : 0,
      remaining: Math.max(parseFloat(g.target_amount) - parseFloat(g.saved_amount), 0),
    }));

    res.json(goals);

  } catch (err) {
    console.error('[Goals] GET error:', err.message);
    res.status(500).json({ error: 'Could not load goals' });
  }
});

// ── CREATE GOAL ───────────────────────────────────────────────
// POST /api/goals
router.post('/', protect, async (req, res) => {
  const userId = req.session.userId;
  const { name, target_amount, target_date, description } = req.body;

  if (!name || !target_amount) {
    return res.status(400).json({
      error: 'Goal name and target amount are required'
    });
  }

  if (parseFloat(target_amount) <= 0) {
    return res.status(400).json({
      error: 'Target amount must be greater than zero'
    });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO saving_goals
         (user_id, name, target_amount, target_date, description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        name.trim(),
        parseFloat(target_amount),
        target_date || null,
        description?.trim() || null,
      ]
    );

    const [rows] = await pool.execute(
      `SELECT * FROM saving_goals WHERE goal_id = ?`,
      [result.insertId]
    );

    const g = rows[0];
    res.status(201).json({
      ...g,
      target_amount: parseFloat(g.target_amount),
      saved_amount:  parseFloat(g.saved_amount),
      percentage:    0,
      remaining:     parseFloat(g.target_amount),
    });

  } catch (err) {
    console.error('[Goals] POST error:', err.message);
    res.status(500).json({ error: 'Could not create goal' });
  }
});

// ── ADD CONTRIBUTION ──────────────────────────────────────────
// POST /api/goals/:id/contribute
router.post('/:id/contribute', protect, async (req, res) => {
  const userId = req.session.userId;
  const goalId = req.params.id;
  const { amount } = req.body;

  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero' });
  }

  try {
    // Verify goal belongs to this user and is not complete
    const [goals] = await pool.execute(
      `SELECT goal_id, name, target_amount, saved_amount, is_complete
       FROM saving_goals
       WHERE goal_id = ? AND user_id = ?`,
      [goalId, userId]
    );

    if (goals.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (goals[0].is_complete) {
      return res.status(400).json({ error: 'This goal is already complete' });
    }

    // Atomic increment — safe against race conditions
    await pool.execute(
      `UPDATE saving_goals
       SET saved_amount = saved_amount + ?
       WHERE goal_id = ? AND user_id = ?`,
      [parseFloat(amount), goalId, userId]
    );

    // Return updated goal
    const [rows] = await pool.execute(
      `SELECT * FROM saving_goals WHERE goal_id = ?`,
      [goalId]
    );

    const g = rows[0];
    const target = parseFloat(g.target_amount);
    const saved  = parseFloat(g.saved_amount);

    res.json({
      ...g,
      target_amount: target,
      saved_amount:  saved,
      percentage:    Math.min(Math.round((saved / target) * 100), 100),
      remaining:     Math.max(target - saved, 0),
    });

  } catch (err) {
    console.error('[Goals] Contribute error:', err.message);
    res.status(500).json({ error: 'Could not add contribution' });
  }
});

// ── MARK COMPLETE ─────────────────────────────────────────────
// PUT /api/goals/:id/complete
router.put('/:id/complete', protect, async (req, res) => {
  const userId = req.session.userId;
  const goalId = req.params.id;

  try {
    const [result] = await pool.execute(
      `UPDATE saving_goals
       SET is_complete = 1
       WHERE goal_id = ? AND user_id = ?`,
      [goalId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ message: 'Goal marked as complete' });

  } catch (err) {
    console.error('[Goals] Complete error:', err.message);
    res.status(500).json({ error: 'Could not update goal' });
  }
});

// ── DELETE GOAL ───────────────────────────────────────────────
// DELETE /api/goals/:id
router.delete('/:id', protect, async (req, res) => {
  const userId = req.session.userId;
  const goalId = req.params.id;

  try {
    const [result] = await pool.execute(
      `DELETE FROM saving_goals
       WHERE goal_id = ? AND user_id = ?`,
      [goalId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ message: 'Goal deleted' });

  } catch (err) {
    console.error('[Goals] DELETE error:', err.message);
    res.status(500).json({ error: 'Could not delete goal' });
  }
});

module.exports = router;