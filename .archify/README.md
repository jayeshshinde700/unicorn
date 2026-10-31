# Unicorn Hospitality - Architecture & Data Flow Guide

This document and the interactive visualization in [`.archify/index.html`](file:///d:/xampp/htdocs/naman/unicorn/.archify/index.html) detail the internal architecture, component boundaries, transactional mechanics, and data movement across the Unicorn Hospitality hotel booking platform.

---

## 1. Executive Architecture Summary

- **Frontend Tier:** Vanilla JavaScript (`assets/js/booking.js`, `assets/js/booking-api.js`, `assets/js/reservation.js`) interacting with static HTML pages (`book-a-room.html`, `rooms.html`, `find-my-reservation.html`). All state is maintained in-memory and in `sessionStorage` (no `localStorage` persistence).
- **Backend API Tier:** Pure PHP 8 JSON endpoints in `/api/` with structured error handling, input validation, and sliding-window rate limiting.
- **Database Engine:** MySQL InnoDB with strict foreign key constraints, composite index keys on date intervals (`idx_room_dates`), and row-level locking (`SELECT ... FOR UPDATE`).
- **Payment Architecture:** **Pay-at-Hotel / Front Desk Settlement**. No 3rd-party payment gateway is integrated. Bookings default to `confirmed` status with zero upfront payment required.
- **Email Notification Engine:** Dual-mode transport in `api/lib/mailer.php` (PHPMailer SMTP with fallback to native PHP `mail()` and 1-second socket pre-flight checks). Completely decoupled and non-blocking.
- **Administration Tier:** Back-office Studio in `/admin/` for room catalog definitions, prices, inventory counts, photography uploads, and activity auditing.

---

## 2. Component Mapping (The 7 Pillars)

### 1. Frontend Pages & User Interactions
- **`book-a-room.html` / `assets/js/booking.js`:** 
  - 3-step booking wizard (Dates & Rooms → Guest Contact Details → Review & Confirm).
  - Dynamic Flatpickr check-in / check-out clamping (`checkOut > checkIn`).
  - Idempotency protection: creates a 128-bit cryptographically secure hex `requestToken` (`sessionStorage['uch_req']`) to prevent double-submit.
- **`rooms.html` / `assets/js/rooms.js`:** 
  - Public showcase querying `api/rooms.php` without date filters. Links directly to `book-a-room.html?room=<id>`.
- **`find-my-reservation.html` / `assets/js/reservation.js`:**
  - Self-service portal for guests. Requires Booking ID (`UCH-XXXXXXXX`) and Email.
  - On authorization, receives an HMAC-SHA256 session token (`sessionStorage['uch_res']`) to view, modify dates, cancel, or download receipts.

### 2. Room Search and Availability Checking
- **`api/rooms.php` & `api/lib/availability.php`:**
  - Evaluates overlap against confirmed and active unexpired pending holds:
    $$\text{booked} = \text{COUNT}(*) \quad \text{where} \quad \text{check\_in} < \text{requested\_out} \ \land \ \text{check\_out} > \text{requested\_in}$$
  - Availability formula: $\text{available} = \max(0, \text{inventory} - \text{booked})$.
  - Rejects if $\text{adults} + \text{children} > \text{room.guests}$ (`capacity`).
  - Cache policy: `public, max-age=30` for generic catalog; `no-store` when stay dates are provided.

### 3. Booking API & Transactional Processing
- **`api/bookings/create.php`:**
  - Origin check (`api_require_same_origin()`) & rate limiting (`api_rate_limit('create')`).
  - Checks if `request_token` exists; if already saved, returns the existing booking gracefully.
  - ACID Transaction:
    1. `$pdo->beginTransaction()`
    2. `booking_find_room(..., lock=true)` $\rightarrow$ `SELECT ... FOR UPDATE`
    3. Re-evaluates availability with lock active. If unavailable, rolls back and returns HTTP 409 Conflict.
    4. Calculates price server-side (disregarding any client price values).
    5. Generates unique booking ID (`UCH-` + 8 chars, avoiding ambiguous letters like `O`, `0`, `I`, `1`) with 5-retry loop.
    6. Inserts into MySQL `bookings`.
    7. `$pdo->commit()`
  - Post-commit: triggers `booking_send_email()` and updates `email_status` (`sent` | `failed` | `disabled`).

### 4. Database Schema & Booking Records
- **`rooms` table:** Master room catalog with `data` LONGTEXT JSON holding inventory, amenities, images, bed types, and seasonal pricing.
- **`bookings` table:** Normalised booking records with `booking_id` (UQ), `request_token` (UQ), dates, price snapshot (`price_per_night`, `subtotal`, `tax_amount`, `total_amount`), and foreign key to `rooms(id)`.
- **`booking_rate_limits` table:** Persistent sliding-window rate limit counters by IP and booking ID.
- **`admin_users` & `admin_activity`:** Admin credentials (bcrypt) and audit trails.

### 5. Payment Gateway Integration
- **Status:** **Pay-at-Hotel (No Online Gateway)**.
- Configured in `api/booking-config.php`:
  ```php
  'payment_note' => 'No advance payment is required. Payment is collected at the front desk on check-in.'
  ```
- No online credit card, UPI, or third-party processor (Stripe, Razorpay, etc.) is integrated in the codebase. Bookings are confirmed directly.

### 6. Email Confirmation System
- **`api/lib/mailer.php`:**
  - Multi-part MIME (Plain Text + HTML table with branded styling).
  - Dual transport: PHPMailer with SMTP (`UCH_SMTP_HOST` env vars) or native PHP `mail()`.
  - Windows/XAMPP safeguard: runs `fsockopen` with 1-second timeout before calling `mail()` so guests do not experience browser hangs.
  - Fault tolerance: wrapped in `try/catch`. Email failures are logged in `api/storage/logs/` and update `bookings.email_status = 'failed'`. They **never** cancel or roll back the booking.

### 7. Admin Dashboard & Reservation Management
- **`admin/index.php` & `admin/api.php`:**
  - Session-authenticated (`unicorn_admin` cookie, CSRF validation, idle timeout 30 mins).
  - Admin Studio manages room types, inventories, pricing, photos, and backups.
  - Booking records live directly in the MySQL `bookings` table; guest self-service adjustments occur via `find-my-reservation.html`.

---

## 3. How to View the Interactive Diagram

Open [`.archify/index.html`](file:///d:/xampp/htdocs/naman/unicorn/.archify/index.html) in your web browser or navigate to:
```
http://localhost/naman/unicorn/.archify/index.html
```
The interactive diagram allows you to inspect component nodes, switch perspectives, review database schemas, and simulate all happy and failure booking scenarios interactively.

