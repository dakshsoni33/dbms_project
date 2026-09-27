// db.js
// One shared connection pool to the MySQL 8.0 database. Every route file
// imports `pool` from here instead of opening its own connection.

const mysql = require('mysql2/promise');

// Edit these five lines to match your own MySQL setup before running the
// server. Values can also be overridden with environment variables, which
// is useful if you don't want your password committed to git.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'your_mysql_password',
  database: process.env.DB_NAME || 'court_pass',
  waitForConnections: true,
  connectionLimit: 10,
  // Without this, mysql2 turns DATE/DATETIME columns into JS Date objects
  // using the server's local timezone, and later code that calls
  // .toISOString() on them shifts the date back by a day on any machine
  // set to a timezone ahead of UTC (India included). Plain strings avoid
  // the conversion entirely.
  dateStrings: true,
});

module.exports = pool;
