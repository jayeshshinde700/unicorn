-- ============================================================
-- Unicorn Hospitality - MySQL Database Schema & Initial Data
-- Database: unicorn_hospitality
-- ============================================================

CREATE DATABASE IF NOT EXISTS `unicorn_hospitality` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `unicorn_hospitality`;

-- ------------------------------------------------------------
-- 1. Table structure for `admin_users`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `admin_users`;
CREATE TABLE `admin_users` (
  `username` VARCHAR(30) NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Admin Account (Username: naman)
INSERT INTO `admin_users` (`username`, `name`, `password_hash`, `created_at`) VALUES ('naman', 'naman', '$2y$10$.zieaCFZ3S95wB1MWRfWAOnoW2gyzBXwfSBtnvsLIDi9Pb5hVV//6', 1793017913);

-- ------------------------------------------------------------
-- 2. Table structure for `rooms`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `rooms`;
CREATE TABLE `rooms` (
  `id` VARCHAR(40) NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `category` ENUM('room','suite') NOT NULL DEFAULT 'room',
  `status` ENUM('published','draft') NOT NULL DEFAULT 'draft',
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `price` INT UNSIGNED NOT NULL,
  `size` INT UNSIGNED NOT NULL,
  `guests` TINYINT UNSIGNED NOT NULL,
  `rank_no` INT NOT NULL DEFAULT 0,
  `data` LONGTEXT NOT NULL,
  `created_at` INT UNSIGNED NOT NULL,
  `updated_at` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status_rank` (`status`, `rank_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Rooms & Suites
INSERT INTO `rooms` (`id`, `name`, `category`, `status`, `featured`, `price`, `size`, `guests`, `rank_no`, `data`, `created_at`, `updated_at`) VALUES ('deluxe', 'delux room', 'room', 'published', 0, 4500, 32, 2, 1, '{\"id\":\"deluxe\",\"name\":\"delux room\",\"category\":\"room\",\"tags\":[\"family\"],\"badge\":{\"text\":\"Most booked\",\"style\":\"gold\"},\"status\":\"published\",\"featured\":false,\"short\":\"Calm neutrals\",\"tagline\":\"Calm, classic comfort\",\"description\":\"A quiet, softly lit room in warm neutrals. The king bed has plush bedding, quality linens and a choice of pillows, and tall windows with floor-length drapes let the morning in. Simple, restful and easy to love.\",\"notes\":\"Check-in from 2:00 PM, check-out by 11:00 AM. Extra bed on request, subject to availability. Breakfast, Wi-Fi, parking and pool access are included.\",\"size\":32,\"guests\":2,\"bed\":\"King bed\",\"view\":\"City light\",\"inventory\":12,\"extraBed\":{\"available\":false,\"price\":0},\"price\":4500,\"seasonal\":{\"festive\":null,\"winter\":null,\"summer\":null,\"monsoon\":null},\"image\":\"assets/images/unicon/rooms/deluxe.jpg\",\"imageAlt\":\"Deluxe Room at Unicorn Hospitality\",\"gallery\":[],\"amenities\":[{\"icon\":\"wifi\",\"label\":\"Free Wi-Fi\"},{\"icon\":\"snow\",\"label\":\"Air-conditioning\"},{\"icon\":\"tv\",\"label\":\"Flat-screen TV\"},{\"icon\":\"cup\",\"label\":\"Tea & coffee maker\"},{\"icon\":\"lock\",\"label\":\"In-room safe\"},{\"icon\":\"bed\",\"label\":\"Choice of pillows\"},{\"icon\":\"bath\",\"label\":\"En-suite bathroom\"},{\"icon\":\"car\",\"label\":\"Free parking\"}],\"features\":{\"desk\":false,\"shower\":false,\"lounge\":false,\"dining\":false,\"apart\":false},\"seoTitle\":\"\",\"seoDescription\":\"\",\"rank\":1,\"createdAt\":1793017963,\"updatedAt\":1793256470,\"updatedBy\":\"naman\"}', 1793017963, 1793256470);
INSERT INTO `rooms` (`id`, `name`, `category`, `status`, `featured`, `price`, `size`, `guests`, `rank_no`, `data`, `created_at`, `updated_at`) VALUES ('executive', 'Executive Room', 'room', 'published', 0, 5800, 38, 2, 2, '{\"id\":\"executive\",\"name\":\"Executive Room\",\"category\":\"room\",\"tags\":[],\"badge\":{\"text\":\"City view\",\"style\":\"light\"},\"status\":\"published\",\"featured\":false,\"short\":\"More space, more light and a window onto the city. Made for business trips that deserve a better night.\",\"tagline\":\"Space to work, room to unwind\",\"description\":\"More space and more light than our Deluxe, with a tall window onto the city. A work corner keeps the laptop close, the king bed keeps the night long. Made for business trips that deserve a better sleep.\",\"notes\":\"Check-in from 2:00 PM, check-out by 11:00 AM. Extra bed on request, subject to availability. Breakfast, Wi-Fi, parking and pool access are included.\",\"size\":38,\"guests\":2,\"bed\":\"King bed\",\"view\":\"City view\",\"inventory\":8,\"extraBed\":{\"available\":false,\"price\":0},\"price\":5800,\"seasonal\":{\"festive\":null,\"winter\":null,\"summer\":null,\"monsoon\":null},\"image\":\"assets/images/unicon/rooms/executive.jpg\",\"imageAlt\":\"Executive Room at Unicorn Hospitality\",\"gallery\":[],\"amenities\":[{\"icon\":\"wifi\",\"label\":\"Free Wi-Fi\"},{\"icon\":\"desk\",\"label\":\"Work corner\"},{\"icon\":\"snow\",\"label\":\"Air-conditioning\"},{\"icon\":\"tv\",\"label\":\"Flat-screen TV\"},{\"icon\":\"cup\",\"label\":\"Tea & coffee maker\"},{\"icon\":\"lock\",\"label\":\"In-room safe\"},{\"icon\":\"sun\",\"label\":\"City-view window\"},{\"icon\":\"car\",\"label\":\"Free parking\"}],\"features\":{\"desk\":true,\"shower\":false,\"lounge\":false,\"dining\":false,\"apart\":false},\"seoTitle\":\"\",\"seoDescription\":\"\",\"rank\":2,\"createdAt\":1793017963,\"updatedAt\":1793256466,\"updatedBy\":\"naman\"}', 1793017963, 1793256466);
INSERT INTO `rooms` (`id`, `name`, `category`, `status`, `featured`, `price`, `size`, `guests`, `rank_no`, `data`, `created_at`, `updated_at`) VALUES ('family', 'Family Suite', 'suite', 'published', 0, 8200, 52, 4, 3, '{\"id\":\"family\",\"name\":\"Family Suite\",\"category\":\"suite\",\"tags\":[\"family\"],\"badge\":{\"text\":\"Best for families\",\"style\":\"light\"},\"status\":\"published\",\"featured\":false,\"short\":\"Room for everyone: twin beds, a separate sleeping area and space to spread out after a long day out.\",\"tagline\":\"Everyone under one roof\",\"description\":\"Twin beds, a separate sleeping area and plenty of space to spread out after a long day. Wooden wardrobes, a bright bathroom and a calm, airy feel make it easy for the whole family to settle in.\",\"notes\":\"Check-in from 2:00 PM, check-out by 11:00 AM. Extra bed on request, subject to availability. Breakfast, Wi-Fi, parking and pool access are included.\",\"size\":52,\"guests\":4,\"bed\":\"2 twin beds\",\"view\":\"Garden side\",\"inventory\":4,\"extraBed\":{\"available\":true,\"price\":1200},\"price\":8200,\"seasonal\":{\"festive\":null,\"winter\":null,\"summer\":null,\"monsoon\":null},\"image\":\"assets/images/unicon/rooms/family.jpg\",\"imageAlt\":\"Family Suite at Unicorn Hospitality\",\"gallery\":[],\"amenities\":[{\"icon\":\"bed\",\"label\":\"Twin beds\"},{\"icon\":\"sofa\",\"label\":\"Extra sleeping space\"},{\"icon\":\"wifi\",\"label\":\"Free Wi-Fi\"},{\"icon\":\"snow\",\"label\":\"Air-conditioning\"},{\"icon\":\"tv\",\"label\":\"Flat-screen TV\"},{\"icon\":\"cup\",\"label\":\"Tea & coffee maker\"},{\"icon\":\"lock\",\"label\":\"In-room safe\"},{\"icon\":\"bath\",\"label\":\"Bathroom with shower\"}],\"features\":{\"desk\":false,\"shower\":false,\"lounge\":true,\"dining\":false,\"apart\":true},\"seoTitle\":\"\",\"seoDescription\":\"\",\"rank\":3,\"createdAt\":1793017963,\"updatedAt\":1793018005,\"updatedBy\":\"naman\"}', 1793017963, 1793018005);
INSERT INTO `rooms` (`id`, `name`, `category`, `status`, `featured`, `price`, `size`, `guests`, `rank_no`, `data`, `created_at`, `updated_at`) VALUES ('premium', 'Premium Suite', 'suite', 'published', 0, 9800, 60, 3, 4, '{\"id\":\"premium\",\"name\":\"Premium Suite\",\"category\":\"suite\",\"tags\":[],\"badge\":{\"text\":\"Warm & glowing\",\"style\":\"light\"},\"status\":\"published\",\"featured\":false,\"short\":\"Layered lighting, a statement headboard wall and a table for a quiet dinner in. Rich, warm and private.\",\"tagline\":\"Rich, warm and private\",\"description\":\"Layered lighting, a statement headboard wall and a small table for a quiet dinner in. The Premium Suite is warm, glowing and generously sized, for guests who like their evenings unhurried.\",\"notes\":\"Check-in from 2:00 PM, check-out by 11:00 AM. Extra bed on request, subject to availability. Breakfast, Wi-Fi, parking and pool access are included.\",\"size\":60,\"guests\":3,\"bed\":\"King bed\",\"view\":\"Courtyard\",\"inventory\":3,\"extraBed\":{\"available\":false,\"price\":0},\"price\":9800,\"seasonal\":{\"festive\":null,\"winter\":null,\"summer\":null,\"monsoon\":null},\"image\":\"assets/images/unicon/rooms/premium.jpg\",\"imageAlt\":\"Premium Suite at Unicorn Hospitality\",\"gallery\":[],\"amenities\":[{\"icon\":\"tv\",\"label\":\"Smart TV\"},{\"icon\":\"sofa\",\"label\":\"Dining nook\"},{\"icon\":\"drop\",\"label\":\"Rain shower\"},{\"icon\":\"wifi\",\"label\":\"Free Wi-Fi\"},{\"icon\":\"desk\",\"label\":\"Work desk\"},{\"icon\":\"snow\",\"label\":\"Air-conditioning\"},{\"icon\":\"lock\",\"label\":\"In-room safe\"},{\"icon\":\"cup\",\"label\":\"Tea & coffee maker\"}],\"features\":{\"desk\":true,\"shower\":true,\"lounge\":true,\"dining\":true,\"apart\":false},\"seoTitle\":\"\",\"seoDescription\":\"\",\"rank\":4,\"createdAt\":1793017963,\"updatedAt\":1793018007,\"updatedBy\":\"naman\"}', 1793017963, 1793018007);
INSERT INTO `rooms` (`id`, `name`, `category`, `status`, `featured`, `price`, `size`, `guests`, `rank_no`, `data`, `created_at`, `updated_at`) VALUES ('unicon', 'The Unicon Suite', 'suite', 'published', 1, 14500, 85, 4, 5, '{\"id\":\"unicon\",\"name\":\"The Unicon Suite\",\"category\":\"suite\",\"tags\":[\"family\",\"signature\"],\"badge\":{\"text\":\"Signature\",\"style\":\"gold\"},\"status\":\"published\",\"featured\":true,\"short\":\"Our most open, light-filled suite. Wide glass doors, natural timber and airy linen, made for slow mornings.\",\"tagline\":\"Our signature suite\",\"description\":\"Our most open, light-filled suite. Wide glass doors, natural timber and airy linen make mornings feel slow in the best way. A private lounge, a king bed and the most space we offer, all in one calm room.\",\"notes\":\"Check-in from 2:00 PM, check-out by 11:00 AM. Extra bed on request, subject to availability. Breakfast, Wi-Fi, parking and pool access are included.\",\"size\":85,\"guests\":4,\"bed\":\"King bed + lounge\",\"view\":\"Open view\",\"inventory\":1,\"extraBed\":{\"available\":false,\"price\":0},\"price\":14500,\"seasonal\":{\"festive\":null,\"winter\":null,\"summer\":null,\"monsoon\":null},\"image\":\"assets/images/unicon/rooms/unicon.webp\",\"imageAlt\":\"The Unicon Suite at Unicorn Hospitality\",\"gallery\":[],\"amenities\":[{\"icon\":\"sun\",\"label\":\"Open view\"},{\"icon\":\"sofa\",\"label\":\"Private lounge\"},{\"icon\":\"drop\",\"label\":\"Rain shower\"},{\"icon\":\"wifi\",\"label\":\"Free Wi-Fi\"},{\"icon\":\"desk\",\"label\":\"Work desk\"},{\"icon\":\"tv\",\"label\":\"Smart TV\"},{\"icon\":\"snow\",\"label\":\"Air-conditioning\"},{\"icon\":\"lock\",\"label\":\"In-room safe\"}],\"features\":{\"desk\":true,\"shower\":true,\"lounge\":true,\"dining\":true,\"apart\":true},\"seoTitle\":\"\",\"seoDescription\":\"\",\"rank\":5,\"createdAt\":1793017963,\"updatedAt\":1793018008,\"updatedBy\":\"naman\"}', 1793017963, 1793018008);

-- ------------------------------------------------------------
-- 3. Table structure for `admin_activity`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `admin_activity`;
CREATE TABLE `admin_activity` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `t` INT UNSIGNED NOT NULL,
  `username` VARCHAR(40) NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `detail` VARCHAR(200) NOT NULL DEFAULT '',
  `ip` VARCHAR(45) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_t` (`t`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. Table structure for `site_meta`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `site_meta`;
CREATE TABLE `site_meta` (
  `k` VARCHAR(40) NOT NULL,
  `v` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `site_meta` (`k`, `v`) VALUES ('installed', UNIX_TIMESTAMP()), ('rooms_saved', '1'), ('rooms_updated', UNIX_TIMESTAMP()) ON DUPLICATE KEY UPDATE `v` = VALUES(`v`);
