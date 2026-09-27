// server.js
// Starts Express, mounts every /api route, and serves the public/ folder
// (the whole frontend) as static files — one server for both.

// Must be required before express() and before any routes — it patches
// Express so that a thrown/rejected error inside an `async` route handler
// actually reaches the error handler below. Without this, Express 4 lets
// those errors fall through silently and the request just hangs forever
// with no response — the worst possible failure mode during a live demo.
require('express-async-errors');

const express = require('express');
const os = require('os');
const path = require('path');

const authRoutes = require('./routes/auth');
const courtRoutes = require('./routes/courts');
const bookingRoutes = require('./routes/bookings');
const penaltyRoutes = require('./routes/penalties');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', authRoutes);
app.use('/api', courtRoutes);
app.use('/api', bookingRoutes);
app.use('/api', penaltyRoutes);
app.use('/api', userRoutes);

// Catch-all error handler so a query error shows up as a clean JSON message
// in the browser instead of the page just hanging.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Court Pass running on port ${PORT}`);
  console.log('Open on this laptop:  http://localhost:' + PORT);

  // Print every LAN IP so you know which address to type into the three
  // phones (they must be on the same WiFi as this laptop).
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`Open on phones:       http://${net.address}:${PORT}`);
      }
    }
  }
});
