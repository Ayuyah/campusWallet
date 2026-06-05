// routes/auth.js
// ─────────────────────────────────────────────────────────────
// Authentication routes: register, login, logout.
//
// WHAT IS bcrypt?
// bcrypt is a password hashing function. When a user registers,
// we never store their actual password. We run it through bcrypt
// which produces a fixed-length scrambled string called a hash.
// When they log in, bcrypt compares the typed password against
// the stored hash without ever reversing it. Even if someone
// steals your database, they cannot read the passwords.
//
// WHAT IS a session?
// HTTP is stateless — every request is independent, the server
// remembers nothing between them. Sessions solve this. When a
// user logs in, we store their user_id in req.session. On every
// subsequent request, express-session reads the session cookie
// the browser sends, looks up the session, and makes req.session
// available again. This is how the server knows who is logged in.
//
// WHERE ELSE YOU SEE THIS PATTERN:
// Every web app that has login uses this exact flow:
// hash on register → compare on login → store in session.
// The tools differ (JWT vs session, argon2 vs bcrypt) but the
// pattern is identical across all frameworks and languages.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const bcrypt  = require('bcrypt');
const router  = express.Router();
const pool    = require('../config/database');

// ── REGISTER ──────────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', async (req, res) => {
  const {
    full_name,
    username,
    email,
    password,
    university,
    course,
    year_of_study,
  } = req.body;

  // Basic validation — check required fields exist
  if (!full_name || !username || !email || !password) {
    return res.status(400).json({ error: 'Name, username, email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Hash the password — 10 is the "salt rounds" (cost factor)
    // Higher = slower to compute = harder to brute force
    // 10 is the industry standard default
    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO users
         (full_name, username, email, password_hash, university, course, year_of_study)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [full_name, username, email, password_hash,
       university || null, course || null, year_of_study || null]
    );

    // Store user_id in session — they are now logged in
    req.session.userId   = result.insertId;
    req.session.username = username;
    req.session.fullName = full_name;

    res.status(201).json({
      message:  'Account created successfully',
      userId:   result.insertId,
      username,
      fullName: full_name,
    });

  } catch (err) {
    // MySQL error code for duplicate entry (username or email taken)
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username or email is already registered' });
    }
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Allow login with either username OR email
    const [rows] = await pool.execute(
      `SELECT user_id, username, full_name, password_hash
       FROM users
       WHERE (username = ? OR email = ?) AND is_active = 1`,
      [username, username]
    );

    if (rows.length === 0) {
      // Intentionally vague — don't tell attacker whether
      // the username exists or the password is wrong
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const user = rows[0];

    // Compare the typed password against the stored hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    // Store in session
    req.session.userId   = user.user_id;
    req.session.username = user.username;
    req.session.fullName = user.full_name;

    res.json({
      message:  'Login successful',
      userId:   user.user_id,
      username: user.username,
      fullName: user.full_name,
    });

  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ── LOGOUT ────────────────────────────────────────────────────
// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// ── SESSION CHECK ─────────────────────────────────────────────
// GET /api/auth/me
// The frontend calls this on page load to check if the user
// is already logged in (session still valid from last visit)
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      loggedIn: true,
      userId:   req.session.userId,
      username: req.session.username,
      fullName: req.session.fullName,
    });
  }
  res.json({ loggedIn: false });
});

module.exports = router;