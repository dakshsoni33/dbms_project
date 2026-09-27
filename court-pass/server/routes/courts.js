// routes/courts.js

const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/courts
// Lists every court with its sport name and its *live* status right now:
// 'maintenance' if the admin marked it so, otherwise 'occupied' if there is
// a currently-approved booking covering this exact minute, otherwise 'free'.
router.get('/courts', async (req, res) => {
  const [courts] = await pool.query(
    `SELECT c.court_id, c.name, c.is_floodlit, c.status, s.name AS sport_name
     FROM Court c
     JOIN Sport s ON s.sport_id = c.sport_id
     ORDER BY s.name, c.name`
  );

  // For each court, check if there's a live booking right now.
  // A course-project-sized table of courts makes one query per court
  // perfectly fine, and it keeps each query easy to read on its own.
  for (const court of courts) {
    if (court.status === 'maintenance') {
      court.live_status = 'maintenance';
      continue;
    }
    const [active] = await pool.query(
      `SELECT booking_id FROM Booking
       WHERE court_id = ? AND status = 'approved'
         AND NOW() BETWEEN CONCAT(booking_date, ' ', start_time)
                        AND CONCAT(booking_date, ' ', end_time)
       LIMIT 1`,
      [court.court_id]
    );
    court.live_status = active.length > 0 ? 'occupied' : 'free';
  }

  res.json(courts);
});

// GET /api/courts/:id/availability?date=YYYY-MM-DD
// Returns the slots already taken on that court/date, so the frontend can
// show the student what's free.
router.get('/courts/:id/availability', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'A date is required, e.g. ?date=2026-09-30' });
  }

  const [taken] = await pool.query(
    `SELECT start_time, end_time, status FROM Booking
     WHERE court_id = ? AND booking_date = ? AND status IN ('pending', 'approved')
     ORDER BY start_time`,
    [id, date]
  );

  res.json(taken);
});

// PATCH /api/courts/:id
// Admin toggles a court between available and maintenance.
router.patch('/courts/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['available', 'maintenance'].includes(status)) {
    return res.status(400).json({ error: "status must be 'available' or 'maintenance'." });
  }

  await pool.query('UPDATE Court SET status = ? WHERE court_id = ?', [status, id]);
  res.json({ court_id: Number(id), status });
});

module.exports = router;
