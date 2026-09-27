// routes/auth.js
// One route: POST /api/login
// This is the only place that decides student vs admin. Everything else
// in the app just trusts the role it was told at login time.

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // LEFT JOIN Admin: if this user is also an admin, admin_id comes back
  // filled in. If not, it comes back NULL. That single column is the
  // entire role check.
  const [rows] = await pool.query(
    `SELECT u.user_id, u.name, u.email, u.password_hash, u.role,
            a.admin_id, a.shift_start, a.shift_end
     FROM User u
     LEFT JOIN Admin a ON a.user_id = u.user_id
     WHERE u.email = ?`,
    [email]
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: 'No account with that email.' });
  }

  const user = rows[0];
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  // Never send the password hash back to the browser.
  delete user.password_hash;

  res.json(user);
});

module.exports = router;
