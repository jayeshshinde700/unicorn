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
  `cancel_reason` VARCHAR(30) NULL,
  `coupon_code` VARCHAR(40) NULL,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` VARCHAR(16) NOT NULL DEFAULT 'unpaid',
  `payment_method` VARCHAR(12) NULL,
  `razorpay_order_id` VARCHAR(40) NULL,
  `razorpay_payment_id` VARCHAR(40) NULL,
  `paid_amount` DECIMAL(12,2) NULL,
  `paid_at` DATETIME NULL,
  `refund_id` VARCHAR(40) NULL,
  `refunded_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `refunded_at` DATETIME NULL,
  `admin_notes` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_booking_id` (`booking_id`),
  UNIQUE KEY `uq_request_token` (`request_token`),
  KEY `idx_email` (`email`),
  KEY `idx_room_dates` (`room_id`, `check_in`, `check_out`),
  KEY `idx_status` (`booking_status`),
  KEY `idx_order` (`razorpay_order_id`),
  KEY `idx_coupon` (`coupon_code`),
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

-- Reservation history: every payment, change, cancellation, refund and e-mail is written here (shown in the admin dashboard)
CREATE TABLE IF NOT EXISTS `booking_events` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` VARCHAR(20) NOT NULL,
  `created_at` DATETIME NOT NULL,
  `actor` VARCHAR(60) NOT NULL,
  `event` VARCHAR(30) NOT NULL,
  `detail` VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Discount coupons (created in the admin dashboard, listed on coupons.html, applied on the booking page)
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `description` VARCHAR(400) NOT NULL DEFAULT '',
  `discount_type` ENUM('percent','flat') NOT NULL DEFAULT 'percent',
  `discount_value` DECIMAL(10,2) NOT NULL,
  `max_discount` DECIMAL(10,2) NULL,
  `min_subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `min_nights` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `applies_to` VARCHAR(10) NOT NULL DEFAULT 'all',
  `valid_from` DATE NULL,
  `valid_to` DATE NULL,
  `stay_from` DATE NULL,
  `stay_to` DATE NULL,
  `usage_limit` INT UNSIGNED NULL,
  `per_email_limit` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_public` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
