-- ============================================================
-- Unicorn Hospitality - booking tables (safe to run more than once)
-- Run in phpMyAdmin (database: unicorn_hospitality) -> Import, or it runs automatically on the first booking request.
-- Does not touch, drop or truncate any existing table.
-- ============================================================

-- A booking reserves ONE room of the given type. Room details come from the existing `rooms` table.
-- Prices are stored as a snapshot so old bookings never change when room prices change.
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` VARCHAR(20) NOT NULL,
  `request_token` CHAR(32) NULL,
  `room_id` VARCHAR(40) NOT NULL,
  `room_name` VARCHAR(60) NOT NULL,
  `guest_first_name` VARCHAR(60) NOT NULL,
  `guest_last_name` VARCHAR(60) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `phone_country` VARCHAR(8) NOT NULL DEFAULT '+91',
  `phone` VARCHAR(20) NOT NULL,
  `check_in` DATE NOT NULL,
  `check_out` DATE NOT NULL,
  `adults` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `children` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `number_of_nights` SMALLINT UNSIGNED NOT NULL,
  `price_per_night` DECIMAL(10,2) NOT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `tax_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `special_requests` TEXT NULL,
  `booking_status` ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  `hold_expires_at` DATETIME NULL,
  `email_status` VARCHAR(12) NOT NULL DEFAULT 'pending',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `cancelled_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_booking_id` (`booking_id`),
  UNIQUE KEY `uq_request_token` (`request_token`),
  KEY `idx_email` (`email`),
  KEY `idx_room_dates` (`room_id`, `check_in`, `check_out`),
  KEY `idx_status` (`booking_status`),
  CONSTRAINT `fk_bookings_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Counts requests per visitor to slow down automated guessing of booking IDs
CREATE TABLE IF NOT EXISTS `booking_rate_limits` (
  `bucket` CHAR(64) NOT NULL,
  `hits` INT UNSIGNED NOT NULL DEFAULT 0,
  `window_start` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`bucket`),
  KEY `idx_window` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
