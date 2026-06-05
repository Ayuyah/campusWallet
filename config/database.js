// config/database.js
// ─────────────────────────────────────────────────────────────
// Creates a connection pool to MariaDB.
//
// WHY A POOL?
// A pool keeps several database connections open and reuses them.
// Without a pool, every user action would open a new connection,
// wait, query, then close it — slow and wasteful.
// With a pool, connections are ready and waiting. Much faster.
//
// WHERE ELSE YOU SEE THIS PATTERN:
// Every production web app uses connection pooling.
// The same pattern exists in Python (SQLAlchemy), Java (HikariCP),
// and PHP (PDO). The concept is universal.
// ─────────────────────────────────────────────────────────────

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               process.env.DB_PORT,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
});

// Test the connection immediately when this file is first loaded.
// If credentials are wrong, the app exits immediately with a clear
// error message rather than failing silently later.
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] Connected to MariaDB successfully');
    conn.release();
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    console.error('[DB] Check: is MariaDB running? Are your .env credentials correct?');
    process.exit(1);
  }
}

testConnection();

module.exports = pool;