# Court Pass

A fair-access booking system for college sports courts — built for the
DBMS course project. Full write-up (introduction, ER diagram, database
design, SQL operations, etc.) is in the synopsis document; this file is
just about getting the app running.

## What's in here

```
court-pass/
├─ server/       Node.js + Express backend (the REST API)
├─ public/       The whole frontend — plain HTML/CSS/JS, no build step
└─ database/     schema.sql and seed.sql for MySQL 8.0
```

## 1. Set up the database

Open a MySQL 8.0 shell (`mysql -u root -p`) or Workbench, and run the two
files in order:

```sql
SOURCE database/schema.sql;
SOURCE database/seed.sql;
```

`schema.sql` creates a fresh `court_pass` database and all seven tables.
`seed.sql` adds three sports, four courts, and four demo accounts.

Then create a dedicated MySQL user for the app instead of using root
(replace the password with your own):

```sql
CREATE USER 'court_pass_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password_here';
GRANT ALL PRIVILEGES ON court_pass.* TO 'court_pass_user'@'localhost';
FLUSH PRIVILEGES;
```

## 2. Configure the backend

Open `server/db.js` and either edit the five values directly, or set
them as environment variables before starting the server:

```
DB_HOST=localhost
DB_USER=court_pass_user
DB_PASSWORD=your_password_here
DB_NAME=court_pass
PORT=3000
```

## 3. Install and run

```bash
cd server
npm install
npm start
```

You should see something like:

```
Court Pass running on port 3000
Open on this laptop:  http://localhost:3000
Open on phones:       http://192.168.1.42:3000
```

Open the `localhost` link in your own browser to confirm it works, then
open the `Open on phones` link (same WiFi network!) on the other two
phones.

## 4. Install it on the three phones

On each phone, open the printed IP address in Chrome, then use the
browser menu → **Add to Home Screen**. This gives each phone a proper
app icon and a full-screen window, with no app store or APK needed.

All three phones run the exact same app — what each one shows depends
only on which account is logged in.

## 5. Demo accounts (from seed.sql)

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Admin   | admin@college.edu   | admin123    |
| Student | rohan@college.edu   | student123  |
| Student | kabir@college.edu   | student123  |
| Student | vikram@college.edu  | student123  |

No bookings are pre-seeded on purpose — creating one live during the demo
(request → approve → active pass → complaint → penalty) is the actual
demonstration.

## Suggested demo flow

1. **Phone A (student, Rohan):** log in, open Courts, request a slot on a
   court starting a few minutes from now (optionally tick a teammate or two
   under "Add teammates").
2. **Phone C (admin):** log in, see the request under Requests, approve it.
3. **Phone A:** open My Passes → Active tab — the pass is now live.
4. **Phone B (student, Vikram):** log in as the "senior" who tries to take
   the same court.
5. **Phone A:** tap File complaint on the active pass, name Vikram, submit.
6. **Phone C (admin):** open Complaints, see the report, set points, and
   uphold it.
7. **Phone B:** open Profile — the penalty and points now show up there.

That loop touches every table in the ER diagram in one pass.

## Notes for the write-up

- `User.password_hash` is the one column not in the original ER diagram —
  it's there because a real login needs something to check against.
  Passwords are hashed with bcrypt, never stored in plain text.
- A complaint and a penalty are the same row in the `Penalty` table, just
  at different stages (`status = 'reported'` → `'upheld'`/`'dismissed'`).
  This keeps the implementation to exactly the entities in the diagram,
  with no separate Complaint table.
- `Booking_Participants` is used for real: when requesting a slot, a
  student can optionally tag teammates from a checklist, and both the
  student's and admin's booking views show "With: ...".
- If you want to reset everything for a clean run, just re-run
  `schema.sql` (it drops and recreates the database) followed by
  `seed.sql`.

## Fixes made after the first build

A few things surfaced during testing and are already fixed in this copy:

- **Active passes not showing up.** `mysql2` converts MySQL `DATE` values
  into JS `Date` objects using the server's local time, and the original
  code then called `.toISOString()` on them — which shifts the date back
  by a day on any machine set to a timezone ahead of UTC (India included).
  An approved booking's date came out one day early, so it always looked
  like it was already over. Fixed by setting `dateStrings: true` on the
  MySQL connection pool in `db.js`, so dates come back as plain strings
  and never go through that conversion at all.
- **A court under maintenance could still be booked.** The home screen
  hid the option, but nothing stopped a request from reaching the API
  directly. `POST /api/bookings` now checks the court's status itself and
  refuses with a 409 if it's under maintenance — the actual fix, with the
  UI hiding it too just for a cleaner experience.
- **`penalty_date` type.** Changed from `DATE DEFAULT (CURRENT_DATE)` to
  `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` — MySQL only allows a
  non-constant default like this on `TIMESTAMP`/`DATETIME` columns.
- **Errors could hang a request forever.** Express 4 doesn't automatically
  catch an error thrown inside an `async` route handler, so any database
  error (a bad ID, a dropped connection) would leave the phone waiting
  with no response and no error message — the worst thing to have happen
  mid-demo. Fixed with the `express-async-errors` package, so every route
  now returns a proper error instead of hanging.
- **Double-clicking Approve.** Approving a request twice would add its
  hours to the student's weekly total twice. `PATCH /api/bookings/:id`
  now only accepts the transition once, from `pending`.

