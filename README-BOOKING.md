# Unicorn Hospitality: Booking System

Real room booking on PHP + MySQL (PDO). No framework, no localStorage database.

## How it works

```
book-a-room.html  --(assets/js/booking.js)-->  api/rooms.php              rooms + live availability + price (MySQL)
                                          -->  api/bookings/create.php     validates, locks the room row, saves, returns the real Booking ID
find-my-reservation.html (assets/js/reservation.js)
                                          -->  api/bookings/lookup.php     Booking ID + email -> reservation
                                          -->  api/bookings/modify.php     change dates / guests / phone / requests (preview or save)
                                          -->  api/bookings/cancel.php     status -> cancelled (row is kept)
                                          -->  api/bookings/calendar.php   .ics file
                                          -->  api/bookings/download.php   print-friendly confirmation (Print / Save as PDF)
```

Both pages read and write the **same** `bookings` table, so a booking made on one page is found on the other.

## Files

| Frontend | Purpose |
|---|---|
| `book-a-room.html`, `assets/css/booking.css`, `assets/js/booking.js` | 3-step booking wizard |
| `find-my-reservation.html`, `assets/css/reservation.css`, `assets/js/reservation.js` | lookup, modify, cancel, print, calendar |
| `assets/js/booking-api.js` | small shared helpers (API calls, date + money formatting) |

| Backend | Purpose |
|---|---|
| `api/booking-config.php` | **all rules you may want to change** (tax, status, cancellation, ID prefix, contact, email) |
| `admin/includes/config.php` | database login (existing file, reused) |
| `admin/includes/db.php` | existing `db()` PDO connection and room helpers (reused) |
| `api/lib/response.php` | JSON output, CSRF/same-origin check, rate limiting, error logging |
| `api/lib/validation.php` | input checks |
| `api/lib/availability.php` | inventory, overlap check, price calculation |
| `api/lib/booking-functions.php` | booking ID, access tokens, cancel/modify rules, `.ics` |
| `api/lib/mailer.php` | confirmation email |
| `api/sql/booking-migration.sql` | creates `bookings` and `booking_rate_limits` (safe to run again) |
| `api/sql/booking-seed-rooms.sql` | optional: adds the 5 starter rooms only if they do not exist |
| `api/storage/` | server logs (`logs/booking-YYYY-MM.log`) and the token secret. Blocked from the web by `.htaccess` |

`api/lib`, `api/sql` and `api/storage` are blocked from direct web access (`.htaccess`, Apache `Require all denied`).

## Database

The existing `rooms` table (edited from the admin dashboard) is the room catalogue. Nothing was dropped or changed. Two tables were added:

* `bookings`: one row per reservation (1 booking = 1 room). Stores a **price snapshot** (`price_per_night`, `subtotal`, `tax_percent`, `tax_amount`, `total_amount`) so old bookings never change when prices change. Cancelled bookings stay in the table with `booking_status = 'cancelled'`.
* `booking_rate_limits`: counters that slow down automated guessing.

`bookings.room_id` has a foreign key to `rooms.id` (`ON DELETE RESTRICT`). A room that has bookings cannot be deleted in the admin: set it to **Draft** instead.

**No double booking:** `create.php` runs in a transaction, locks that room's row with `SELECT ... FOR UPDATE`, counts overlapping bookings again and only then inserts. Overlap rule: `existing_checkin < requested_checkout AND existing_checkout > requested_checkin`. Counted: `confirmed`, and `pending` bookings whose hold has not expired. Not counted: `cancelled` and expired `pending`.

## Run it on XAMPP

1. Start **Apache** and **MySQL** in the XAMPP control panel.
2. Open `http://localhost/naman/unicorn/book-a-room.html`. The database and the two booking tables are created automatically on the first request.
   * Manual alternative: phpMyAdmin -> database `unicorn_hospitality` -> Import -> `api/sql/booking-migration.sql` (and optionally `booking-seed-rooms.sql`).
3. If MySQL `root` has a password, put it in `admin/includes/config.php` (`DB_PASS`).
4. Book a room, then open `find-my-reservation.html`, enter the Booking ID and email.

## Change things

| I want to change | Do this |
|---|---|
| Room name, price, image, capacity, amenities, how many rooms of a type exist (inventory) | Admin dashboard -> Rooms (stored in the `rooms` table) |
| Add another room | Admin dashboard -> add a room, set **Inventory**, publish. It appears on the booking page automatically |
| Tax | `api/booking-config.php` -> `tax_percent` (e.g. `12`). While it is `0` no tax line is added |
| New bookings: confirmed or pending | `default_status` (`pending` rooms are held for `pending_hold_minutes`) |
| Cancellation | `cancellation` -> `free_until_hours`, `allow_late_cancellation`, `text` |
| Online changes | `modification` -> `allowed_until_hours`, `reprice_at_current_rate` |
| Booking ID prefix / length | `booking_id_prefix`, `booking_id_length` |
| Reservations phone / email | `contact` |
| Longest stay, how far ahead, max guests | `max_nights`, `max_advance_days`, `max_adults`, `max_children` |
| Abuse limits | `rate_limit` |

## Email

PHPMailer is **not** installed, and XAMPP has no mail server by default, so the confirmation email is reported as **failed** (the booking is still saved). To turn email on:

1. In the project root run `composer require phpmailer/phpmailer`.
2. Set environment variables (Apache `SetEnv` or system env): `UCH_SMTP_HOST`, `UCH_SMTP_PORT`, `UCH_SMTP_USER`, `UCH_SMTP_PASS`, `UCH_SMTP_SECURE` (`tls` or `ssl`).
3. Set `email.from` in `api/booking-config.php`.

The email result is stored in `bookings.email_status` (`sent`, `failed`, `disabled`) and shown to the guest honestly. Problems are written to `api/storage/logs/`.

## Security summary

Prepared statements everywhere; server-side validation and server-side prices; same-origin + JSON-only requests on every write endpoint (CSRF); rate limiting on lookup/create/actions; generic "not found" message; booking IDs from `random_int`; guests see the reservation only after ID + email match; after that the browser holds a signed 30-minute token in `sessionStorage` (never the email, never in localStorage); all guest text is escaped on output; database errors are logged, never shown.

## Check a booking in phpMyAdmin

```sql
SELECT booking_id, room_name, guest_first_name, guest_last_name, email, check_in, check_out,
       adults, children, number_of_nights, total_amount, booking_status, email_status, created_at
FROM bookings ORDER BY id DESC LIMIT 20;

-- how many rooms of each type are taken on a night (change the date)
SELECT room_id, COUNT(*) AS booked FROM bookings
WHERE booking_status IN ('confirmed','pending') AND check_in <= '2026-12-20' AND check_out > '2026-12-20'
GROUP BY room_id;

-- remove test bookings before launch
DELETE FROM bookings WHERE email LIKE '%@example.com';
```

## API quick reference

All responses: `{"success": true|false, "message": "...", "data": {...}}` (errors have `"errors": {field: message}`). Status codes: 200/201 ok, 403 blocked or not allowed, 404 not found, 409 not available, 422 invalid input, 429 too many attempts, 503 database down.

* `GET api/rooms.php?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&adults=2&children=0&type=all|room|suite`: rooms with `availability` (`bookable`, `available`, `reason`, `quote`). Without dates it returns the plain room list used by `rooms.html`.
* `POST api/bookings/create.php`: `roomId, checkIn, checkOut, adults, children, firstName, lastName, email, phoneCountry, phone, specialRequests, requestToken`.
* `POST api/bookings/lookup.php`: `bookingId` + `email` (or `token`).
* `POST api/bookings/modify.php`: `bookingId`, `email|token`, `checkIn, checkOut, adults, children, phoneCountry, phone, specialRequests`, `preview: true` to only calculate.
* `POST api/bookings/cancel.php`: `bookingId`, `email|token`.
* `GET api/bookings/calendar.php?id=...&token=...`, `GET api/bookings/download.php?id=...&token=...`.

## Not included (on purpose)

No payment gateway (guests pay at the hotel, as the existing page says), no multi-room bookings, no seasonal/extra-bed pricing (the base nightly price is used), no PDF library (the confirmation is a print-friendly page).
