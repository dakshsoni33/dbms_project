// routes/users.js

const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/users?role=student
// Used to populate the "who displaced you" dropdown on the complaint form.
router.get('/users', async (req, res) => {
  const { role } = req.query;
  const [rows] = await pool.query(
    'SELECT user_id, name, email FROM User WHERE role = ? ORDER BY name',
    [role || 'student']
  );
  res.json(rows);
});

// GET /api/users/:id
// Fresh profile numbers (weekly_hours_used changes over time, so the
// profile screen re-fetches this instead of trusting the login response).
router.get('/users/:id', async (req, res) => {
  const [[u]] = await pool.query(
    'SELECT user_id, name, email, account_status, weekly_hours_used FROM User WHERE user_id = ?',
    [req.params.id]
  );
  if (!u) return res.status(404).json({ error: 'User not found.' });
  res.json(u);
});

module.exports = router;
