// routes/bookings.js

const express = require('express');
const pool = require('../db');

const router = express.Router();

// POST /api/bookings
// A student requests a slot. Starts life as 'pending' until an admin acts.
// participant_ids is optional — teammates tagged onto this booking via
// Booking_Participants (e.g. the rest of the five-a-side team).
router.post('/bookings', async (req, res) => {
  const { court_id, user_id, booking_date, start_time, end_time, participant_ids } = req.body;

  if (!court_id || !user_id || !booking_date || !start_time || !end_time) {
    return res.status(400).json({ error: 'court_id, user_id, booking_date, start_time and end_time are all required.' });
  }
  if (start_time >= end_time) {
    return res.status(400).json({ error: 'end_time must be after start_time.' });
  }

  // Checking this here (not just hiding it in the UI) matters: the UI can
  // only stop a well-behaved app from asking, not a direct API call.
  const [[court]] = await pool.query('SELECT status FROM Court WHERE court_id = ?', [court_id]);
  if (!court) {
    return res.status(404).json({ error: 'Court not found.' });
  }
  if (court.status === 'maintenance') {
    return res.status(409).json({ error: 'This court is under maintenance and cannot be booked right now.' });
  }

  // Refuse a request that overlaps a slot someone already holds or is
  // waiting on, so two people can't both think they have the same slot.
  const [clashes] = await pool.query(
    `SELECT booking_id FROM Booking
     WHERE court_id = ? AND booking_date = ? AND status IN ('pending', 'approved')
       AND start_time < ? AND end_time > ?`,
    [court_id, booking_date, end_time, start_time]
  );
  if (clashes.length > 0) {
    return res.status(409).json({ error: 'That slot overlaps an existing request or booking.' });
  }

  const [result] = await pool.query(
    `INSERT INTO Booking (court_id, user_id, booking_date, start_time, end_time)
     VALUES (?, ?, ?, ?, ?)`,
    [court_id, user_id, booking_date, start_time, end_time]
  );

  // De-duplicate and drop the requester's own id (they're already the
  // booking's owner, not a "participant" of it) before inserting.
  if (Array.isArray(participant_ids)) {
    const teammateIds = [...new Set(participant_ids.map(Number))].filter((id) => id !== Number(user_id));
    for (const teammateId of teammateIds) {
      await pool.query(
        'INSERT IGNORE INTO Booking_Participants (booking_id, user_id) VALUES (?, ?)',
        [result.insertId, teammateId]
      );
    }
  }

  res.status(201).json({ booking_id: result.insertId, status: 'pending' });
});

// GET /api/bookings?user_id=5
// A student's own bookings, sorted into pending / active / past so the
// frontend can render the three tabs directly.
router.get('/bookings', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required.' });
  }

  const [rows] = await pool.query(
    `SELECT b.booking_id, b.status, b.booking_date, b.start_time, b.end_time,
            c.name AS court_name, s.name AS sport_name
     FROM Booking b
     JOIN Court c ON c.court_id = b.court_id
     JOIN Sport s ON s.sport_id = c.sport_id
     WHERE b.user_id = ?
     ORDER BY b.booking_date DESC, b.start_time DESC`,
    [user_id]
  );

  const bookings = [];
  for (const b of rows) {
    const start = new Date(`${toDateString(b.booking_date)}T${b.start_time}`);
    const end = new Date(`${toDateString(b.booking_date)}T${b.end_time}`);
    const now = new Date();

    let bucket = 'past';
    let is_live = false;

    if (b.status === 'pending') {
      bucket = 'pending';
    } else if (b.status === 'approved' && now <= end) {
      bucket = 'active';
      is_live = now >= start && now <= end;
    }

    bookings.push({ ...b, bucket, is_live, participants: await getParticipantNames(b.booking_id) });
  }

  res.json(bookings);
});

// GET /api/bookings/pending
// The admin's approval queue.
router.get('/bookings/pending', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.booking_id, b.booking_date, b.start_time, b.end_time,
            c.name AS court_name, s.name AS sport_name,
            u.name AS student_name, u.email AS student_email
     FROM Booking b
     JOIN Court c ON c.court_id = b.court_id
     JOIN Sport s ON s.sport_id = c.sport_id
     JOIN User u ON u.user_id = b.user_id
     WHERE b.status = 'pending'
     ORDER BY b.booking_date, b.start_time`
  );

  for (const r of rows) {
    r.participants = await getParticipantNames(r.booking_id);
  }

  res.json(rows);
});

// PATCH /api/bookings/:id
// Admin approves or rejects. Approving also adds the slot's hours onto the
// student's weekly_hours_used, since that field only means something once
// something updates it.
router.patch('/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status, admin_id } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: "status must be 'approved' or 'rejected'." });
  }
  if (!admin_id) {
    return res.status(400).json({ error: 'admin_id is required.' });
  }

  const [[booking]] = await pool.query('SELECT * FROM Booking WHERE booking_id = ?', [id]);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }
  if (booking.status !== 'pending') {
    return res.status(409).json({ error: `This request was already ${booking.status}.` });
  }

  await pool.query('UPDATE Booking SET status = ?, admin_id = ? WHERE booking_id = ?', [status, admin_id, id]);

  if (status === 'approved') {
    await pool.query(
      `UPDATE User
       SET weekly_hours_used = weekly_hours_used + TIME_TO_SEC(TIMEDIFF(?, ?)) / 3600
       WHERE user_id = ?`,
      [booking.end_time, booking.start_time, booking.user_id]
    );
  }

  res.json({ booking_id: Number(id), status });
});

function toDateString(value) {
  // mysql2 can return DATE columns as Date objects or as strings
  // depending on driver config, so normalise to YYYY-MM-DD either way.
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function getParticipantNames(bookingId) {
  const [rows] = await pool.query(
    `SELECT u.name FROM Booking_Participants bp
     JOIN User u ON u.user_id = bp.user_id
     WHERE bp.booking_id = ?`,
    [bookingId]
  );
  return rows.map((r) => r.name);
}

module.exports = router;
