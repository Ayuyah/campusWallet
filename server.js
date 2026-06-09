// server.js
// ─────────────────────────────────────────────────────────────
// The entry point. This is the file Node.js runs when you
// type "npm start". It:
//   1. Creates the Express app
//   2. Configures middleware (things that run on every request)
//   3. Connects all the routes (which URL does what)
//   4. Starts listening for requests on a port
//
// WHAT IS EXPRESS?
// Express is a framework that sits on top of Node.js.
// Node.js can handle HTTP requests, but doing it raw is verbose.
// Express gives you clean tools: app.get(), app.post(), middleware.
// It's the most widely used Node.js framework in the world.
//
// WHAT IS MIDDLEWARE?
// Middleware is code that runs between a request arriving and
// your route handler responding. Think of it as a checklist:
// every request goes through the list before reaching its destination.
// Examples: parse JSON body, check if user is logged in, log the request.
// ─────────────────────────────────────────────────────────────

require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const path       = require('path');

// Import route handlers — one file per feature area
const authRoutes    = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const incomeRoutes  = require('./routes/income');
const budgetRoutes  = require('./routes/budgets');
const goalRoutes    = require('./routes/goals');
const reportRoutes  = require('./routes/reports');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────────
// These run on EVERY request, in the order they are listed.

// 1. Parse incoming JSON request bodies
//    Without this, req.body is undefined when the frontend
//    sends data as JSON (which it always does in this app).
app.use(express.json());

// 2. Parse URL-encoded form data (standard HTML form submissions)
app.use(express.urlencoded({ extended: true }));

// 3. Session management
//    Sessions are how the server remembers who is logged in.
//    When a user logs in, we store their user_id in the session.
//    On every subsequent request, we can read that user_id back.
//    The secret is used to sign the session cookie — keeps it tamper-proof.
app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   false,    // set to true when using HTTPS in production
    httpOnly: true,     // JS in the browser cannot read this cookie
    maxAge:   1000 * 60 * 60 * 24,  // 24 hours in milliseconds
  }
}));

// 4. Serve static files from the public/ folder
//    This makes everything in public/ directly accessible in the browser.
//    public/index.html  → http://localhost:3000/index.html
//    public/css/base.css → http://localhost:3000/css/base.css
//    public/js/auth.js  → http://localhost:3000/js/auth.js
app.use(express.static(path.join(__dirname, 'public')));

// ── ROUTES ────────────────────────────────────────────────────
// Each feature has its own route file.
// The first argument is the prefix — all routes inside that file
// automatically start with that prefix.
// e.g. a route defined as router.post('/login') in routes/auth.js
// becomes accessible at POST /api/auth/login

app.use('/api/auth',     authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/income',   incomeRoutes);
app.use('/api/budgets',  budgetRoutes);
app.use('/api/goals',    goalRoutes);
app.use('/api/reports',  reportRoutes);

// ── CATCH-ALL ROUTE ───────────────────────────────────────────
// Any URL that doesn't match a static file or API route
// gets served index.html. This lets the frontend handle routing.
// Root → landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Explicit routes for known HTML pages
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/app.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/landing.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Everything else → landing page
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// ── START SERVER ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] CampusWallet running at http://localhost:${PORT}`);
});