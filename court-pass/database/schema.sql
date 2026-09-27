-- Court Pass — database schema
-- MySQL 8.0
-- Matches the submitted ER diagram. One addition beyond the diagram:
-- User.password_hash, needed for real login (see README).

DROP DATABASE IF EXISTS court_pass;
CREATE DATABASE court_pass CHARACTER SET utf8mb4;
USE court_pass;

-- ---------- Sport ----------
CREATE TABLE Sport (
    sport_id     INT PRIMARY KEY AUTO_INCREMENT,
    name         VARCHAR(50) NOT NULL,
    min_players  INT NOT NULL
) ENGINE=InnoDB;

-- ---------- User ----------
CREATE TABLE User (
    user_id             INT PRIMARY KEY AUTO_INCREMENT,
    name                VARCHAR(50) NOT NULL,
    email               VARCHAR(100) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    role                ENUM('student', 'admin') NOT NULL DEFAULT 'student',
    account_status      ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    weekly_hours_used   DECIMAL(4,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ---------- Admin ----------
CREATE TABLE Admin (
    admin_id     INT PRIMARY KEY AUTO_INCREMENT,
    user_id      INT NOT NULL UNIQUE,
    shift_start  TIME NOT NULL,
    shift_end    TIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Court ----------
CREATE TABLE Court (
    court_id     INT PRIMARY KEY AUTO_INCREMENT,
    name         VARCHAR(50) NOT NULL,
    is_floodlit  BOOLEAN NOT NULL DEFAULT FALSE,
    status       ENUM('available', 'maintenance') NOT NULL DEFAULT 'available',
    sport_id     INT NOT NULL,
    FOREIGN KEY (sport_id) REFERENCES Sport(sport_id)
) ENGINE=InnoDB;

-- ---------- Booking ----------
CREATE TABLE Booking (
    booking_id    INT PRIMARY KEY AUTO_INCREMENT,
    court_id      INT NOT NULL,
    user_id       INT NOT NULL,
    admin_id      INT,
    status        ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    booking_date  DATE NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (court_id) REFERENCES Court(court_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (admin_id) REFERENCES Admin(admin_id)
) ENGINE=InnoDB;

-- ---------- Booking_Participants ----------
CREATE TABLE Booking_Participants (
    booking_id  INT NOT NULL,
    user_id     INT NOT NULL,
    PRIMARY KEY (booking_id, user_id),
    FOREIGN KEY (booking_id) REFERENCES Booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(user_id)
) ENGINE=InnoDB;

-- ---------- Penalty ----------
-- A complaint and a penalty are the same row at different stages:
-- a student's complaint is filed as a Penalty with status 'reported'
-- and points 0; an admin reviewing it fills in points/status/admin_id.
--
-- penalty_date is TIMESTAMP rather than DATE: MySQL only allows a
-- non-constant function like CURRENT_DATE as a DEFAULT on TIMESTAMP/
-- DATETIME columns, not on DATE — hence the error on the original
-- `DATE ... DEFAULT (CURRENT_DATE)`.
CREATE TABLE Penalty (
    penalty_id    INT PRIMARY KEY AUTO_INCREMENT,
    user_id       INT NOT NULL,
    admin_id      INT,
    booking_id    INT,
    reason        VARCHAR(255) NOT NULL,
    penalty_date  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    points        INT NOT NULL DEFAULT 0,
    status        ENUM('reported', 'upheld', 'dismissed') NOT NULL DEFAULT 'reported',
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (admin_id) REFERENCES Admin(admin_id),
    FOREIGN KEY (booking_id) REFERENCES Booking(booking_id)
) ENGINE=InnoDB;

CREATE INDEX idx_booking_court_date ON Booking(court_id, booking_date);
CREATE INDEX idx_booking_user ON Booking(user_id);
CREATE INDEX idx_penalty_user ON Penalty(user_id);
