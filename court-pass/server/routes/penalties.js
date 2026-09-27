// routes/penalties.js
//
// A complaint and a penalty are the same row at different stages. A student
// files a complaint -> INSERT into Penalty with status 'reported', points 0.
// An admin reviews it -> UPDATE the same row with points + 'upheld'/'dismissed'.
// This keeps the design to exactly the entities in the ER diagram, with no
// separate Complaint table.

const express = require('express');
const pool = require('../db');

const router = express.Router();

// POST /api/complaints
// Filed by a student who is currently holding an active pass. booking_id is
// *their* booking (the one being defended) — that's what lets the admin see
// which pass-holder was displaced, with no extra column needed.
router.post('/complaints', async (req, res) => {
  const { offender_user_id, booking_id, reason } = req.body;

  if (!offender_user_id || !booking_id || !reason) {
    return res.status(400).json({ error: 'offender_user_id, booking_id and reason are all required.' });
  }

  const [result] = await pool.query(
    `INSERT INTO Penalty (user_id, booking_id, reason, status, points)
     VALUES (?, ?, ?, 'reported', 0)`,
    [offender_user_id, booking_id, reason]
  );

  res.status(201).json({ penalty_id: result.insertId, status: 'reported' });
});

// POST /api/penalties
// Admin issues a penalty directly (no prior complaint needed) — covers any
// improper behaviour or clash the admin witnesses or hears about firsthand.
router.post('/penalties', async (req, res) => {
  const { user_id, admin_id, reason, points, booking_id } = req.body;

  if (!user_id || !admin_id || !reason || points == null) {
    return res.status(400).json({ error: 'user_id, admin_id, reason and points are required.' });
  }

  const [result] = await pool.query(
    `INSERT INTO Penalty (user_id, admin_id, booking_id, reason, points, status)
     VALUES (?, ?, ?, ?, ?, 'upheld')`,
    [user_id, admin_id, booking_id || null, reason, points]
  );

  res.status(201).json({ penalty_id: result.insertId, status: 'upheld' });
});

// GET /api/penalties/pending
// Admin's review queue: complaints nobody has ruled on yet.
router.get('/penalties/pending', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.penalty_id, p.reason, p.penalty_date,
            offender.name AS offender_name,
            complainant.name AS complainant_name,
            c.name AS court_name, b.booking_date, b.start_time, b.end_time
     FROM Penalty p
     JOIN User offender ON offender.user_id = p.user_id
     LEFT JOIN Booking b ON b.booking_id = p.booking_id
     LEFT JOIN User complainant ON complainant.user_id = b.user_id
     LEFT JOIN Court c ON c.court_id = b.court_id
     WHERE p.status = 'reported'
     ORDER BY p.penalty_date`
  );
  res.json(rows);
});

// PATCH /api/penalties/:id
// Admin resolves a complaint: sets the points and the final status.
router.patch('/penalties/:id', async (req, res) => {
  const { id } = req.params;
  const { admin_id, points, status } = req.body;

  if (!admin_id || points == null || !['upheld', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: "admin_id, points, and status ('upheld' or 'dismissed') are required." });
  }

  await pool.query(
    'UPDATE Penalty SET admin_id = ?, points = ?, status = ? WHERE penalty_id = ?',
    [admin_id, points, status, id]
  );

  res.json({ penalty_id: Number(id), status, points });
});

// GET /api/penalties?user_id=5
// A student's own penalty history, for their profile screen.
router.get('/penalties', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required.' });
  }

  const [rows] = await pool.query(
    `SELECT penalty_id, reason, penalty_date, points, status
     FROM Penalty WHERE user_id = ? ORDER BY penalty_date DESC`,
    [user_id]
  );

  res.json(rows);
});

// GET /api/penalties/leaderboard
// The aggregate report from the synopsis — total upheld penalty points per
// student. Handy as an admin "Reports" screen during the demo.
router.get('/penalties/leaderboard', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.name, SUM(p.points) AS total_points
     FROM Penalty p
     JOIN User u ON u.user_id = p.user_id
     WHERE p.status = 'upheld'
     GROUP BY u.user_id, u.name
     ORDER BY total_points DESC`
  );
  res.json(rows);
});

module.exports = router;
