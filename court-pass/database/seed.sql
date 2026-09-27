-- Court Pass — seed data
-- Gives you ready-to-use accounts for the live demo. Bookings are not
-- pre-seeded on purpose — creating one live (request → approve → pass →
-- complaint → penalty) is the actual demo.

USE court_pass;

-- ---------- Sports ----------
INSERT INTO Sport (name, min_players) VALUES
('Badminton', 2),
('Football', 10),
('Basketball', 6);

-- ---------- Courts ----------
INSERT INTO Court (name, is_floodlit, sport_id) VALUES
('Badminton Court 1', FALSE, 1),
('Badminton Court 2', TRUE,  1),
('Football Ground',   TRUE,  2),
('Basketball Court',  FALSE, 3);

-- ---------- Users ----------
-- Password for the admin account below is: admin123
-- Password for every student account below is: student123
INSERT INTO User (name, email, password_hash, role) VALUES
('Aditi Rao',    'admin@college.edu',  '$2b$10$fd9FZt99q0f.080sZEAmm.NwBsbsfNCvD1KLeeD.SYLKCK5w3UyGm', 'admin'),
('Rohan Mehta',  'rohan@college.edu',  '$2b$10$BeCRP1Cb2oJCh.h9S.gfKeGLvHVZUDw3GWiDVG1jDOGPoNl/aAtEC', 'student'),
('Kabir Singh',  'kabir@college.edu',  '$2b$10$BeCRP1Cb2oJCh.h9S.gfKeGLvHVZUDw3GWiDVG1jDOGPoNl/aAtEC', 'student'),
('Vikram Joshi', 'vikram@college.edu', '$2b$10$BeCRP1Cb2oJCh.h9S.gfKeGLvHVZUDw3GWiDVG1jDOGPoNl/aAtEC', 'student');

-- ---------- Admin shift ----------
INSERT INTO Admin (user_id, shift_start, shift_end)
VALUES ((SELECT user_id FROM User WHERE email = 'admin@college.edu'), '16:00:00', '20:00:00');
