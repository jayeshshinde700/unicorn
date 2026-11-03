<?php
/* Booking API - schema, booking IDs, access tokens, rules (cancel / modify) and the public booking shape. */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

/* ---------- schema (safe to run every time: CREATE TABLE IF NOT EXISTS; also provided as api/sql/booking-migration.sql) ---------- */
function booking_ensure_schema(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $sql = preg_replace('/^\s*--.*$/m', '', (string)file_get_contents(dirname(__DIR__) . '/sql/booking-migration.sql'));
    foreach (array_filter(array_map('trim', preg_split('/;\s*[\r\n]+/', (string)$sql))) as $stmt) {
        if (stripos($stmt, 'CREATE TABLE') === 0) $pdo->exec($stmt);
    }
    /* Installs made before payments existed already have a `bookings` table: add the new columns once (CREATE TABLE IF NOT EXISTS cannot do that). */
    $have = array_column($pdo->query('SHOW COLUMNS FROM bookings')->fetchAll(), 'Field');
    $new = [
        'cancel_reason' => 'VARCHAR(30) NULL', 'coupon_code' => 'VARCHAR(40) NULL', 'discount_amount' => 'DECIMAL(12,2) NOT NULL DEFAULT 0.00',
        'payment_status' => "VARCHAR(16) NOT NULL DEFAULT 'unpaid'", 'payment_method' => 'VARCHAR(12) NULL',
        'razorpay_order_id' => 'VARCHAR(40) NULL', 'razorpay_payment_id' => 'VARCHAR(40) NULL', 'paid_amount' => 'DECIMAL(12,2) NULL', 'paid_at' => 'DATETIME NULL',
        'refund_id' => 'VARCHAR(40) NULL', 'refunded_amount' => 'DECIMAL(12,2) NOT NULL DEFAULT 0.00', 'refunded_at' => 'DATETIME NULL', 'admin_notes' => 'TEXT NULL',
    ];
    foreach ($new as $col => $def) if (!in_array($col, $have, true)) $pdo->exec("ALTER TABLE bookings ADD COLUMN `$col` $def");
    $done = true;
}

/* ---------- reservation history (shown in the admin dashboard). actor: 'guest', 'system', 'razorpay' or 'admin:<username>' ---------- */
function booking_log_event(PDO $pdo, string $bookingId, string $actor, string $event, string $detail = ''): void {
    try {
        $pdo->prepare('INSERT INTO booking_events (booking_id, created_at, actor, event, detail) VALUES (?,?,?,?,?)')
            ->execute([$bookingId, date('Y-m-d H:i:s'), mb_substr($actor, 0, 60), mb_substr($event, 0, 30), mb_substr($detail, 0, 255)]);
    } catch (Throwable $e) { /* history must never break a booking */ }
}

/* Unpaid holds that ran out of time become "abandoned" (cancelled, reason hold_expired). The room is free again. */
function booking_expire_holds(PDO $pdo): void {
    $now = date('Y-m-d H:i:s');
    $pdo->prepare("UPDATE bookings SET booking_status = 'cancelled', cancel_reason = 'hold_expired', cancelled_at = ?, updated_at = ?
                   WHERE booking_status = 'pending' AND hold_expires_at IS NOT NULL AND hold_expires_at < ?")->execute([$now, $now, $now]);
}

/* cancel_reason values for bookings that were never paid (guest left the payment window). They are not real reservations. */
const BOOKING_ABANDONED = ['hold_expired', 'replaced', 'payment_error'];

/* ---------- booking ID: UCH-XXXXXXXX from a cryptographically secure source ---------- */
function booking_new_id(): string {
    $cfg = booking_config();
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   /* no 0/O/1/I to avoid mistakes when reading it out */
    $id = '';
    for ($i = 0; $i < (int)$cfg['booking_id_length']; $i++) $id .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return $cfg['booking_id_prefix'] . '-' . $id;
}

function booking_clean_id($v): string {
    return strtoupper(preg_replace('/[^A-Za-z0-9\-]/', '', v_text($v, 24)) ?? '');
}

/* ---------- access tokens: after a successful lookup the browser holds a signed, time-limited token instead of the email ---------- */
function booking_secret(): string {
    $file = dirname(__DIR__) . '/storage/secret.key';
    if (!is_file($file)) {
        @mkdir(dirname($file), 0775, true);
        @file_put_contents($file, bin2hex(random_bytes(32)), LOCK_EX);
    }
    return (string)@file_get_contents($file);
}
function booking_b64(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function booking_make_token(string $bookingId): string {
    $exp = time() + 60 * (int)booking_config()['access_token_minutes'];
    $payload = booking_b64($bookingId . '|' . $exp);
    return $payload . '.' . hash_hmac('sha256', $payload, booking_secret());
}
function booking_token_ok(string $token, string $bookingId): bool {
    $parts = explode('.', $token);
    if (count($parts) !== 2) return false;
    if (!hash_equals(hash_hmac('sha256', $parts[0], booking_secret()), $parts[1])) return false;
    $raw = base64_decode(strtr($parts[0], '-_', '+/'), true);
    if ($raw === false || strpos($raw, '|') === false) return false;
    [$id, $exp] = explode('|', $raw, 2);
    return hash_equals($id, $bookingId) && (int)$exp >= time();
}

/* Find a booking by ID and prove ownership with the email OR a valid token. Returns the row, or null (never says which part failed). */
function booking_authorize(PDO $pdo, array $in): ?array {
    $id = booking_clean_id($in['bookingId'] ?? ($in['booking_id'] ?? ($in['id'] ?? '')));
    if ($id === '') return null;
    $s = $pdo->prepare('SELECT * FROM bookings WHERE booking_id = ?');
    $s->execute([$id]);
    $row = $s->fetch();
    $dummy = $row['email'] ?? 'nobody@invalid.invalid';          /* keeps timing similar when the ID does not exist */
    $emailIn = strtolower(v_text($in['email'] ?? '', 190));
    $token = v_text($in['token'] ?? '', 300);
    $ok = false;
    if ($emailIn !== '') $ok = hash_equals(strtolower($dummy), $emailIn);
    elseif ($token !== '') $ok = booking_token_ok($token, $id);
    if ($row && ($row['booking_status'] === 'pending' || in_array($row['cancel_reason'] ?? '', BOOKING_ABANDONED, true))) return null;   /* never paid = not a reservation */
    return ($row && $ok) ? $row : null;
}

/* ---------- rules ---------- */
function booking_hours_until_checkin(array $row): float {
    $checkin = new DateTime($row['check_in'] . ' 14:00:00');
    return ($checkin->getTimestamp() - time()) / 3600;
}
/* Returns [allowed(bool), reason(string)] */
function booking_can_cancel(array $row): array {
    $c = booking_config()['cancellation'];
    if ($row['booking_status'] === 'cancelled') return [false, 'This reservation is already cancelled.'];
    if (new DateTime($row['check_out']) <= new DateTime('today')) return [false, 'This stay has already ended.'];
    $h = booking_hours_until_checkin($row);
    if ($h < 0) return [false, 'This stay has already started. Please contact reservations.'];
    if ($h < (int)$c['free_until_hours'] && empty($c['allow_late_cancellation']))
        return [false, 'Online cancellation closes ' . (int)$c['free_until_hours'] . ' hours before check-in. Please contact our reservations team.'];
    return [true, ''];
}
function booking_can_modify(array $row): array {
    $m = booking_config()['modification'];
    if ($row['booking_status'] === 'cancelled') return [false, 'This reservation is cancelled and cannot be changed.'];
    if (new DateTime($row['check_out']) <= new DateTime('today')) return [false, 'This stay has already ended.'];
    if (booking_hours_until_checkin($row) < (int)$m['allowed_until_hours'])
        return [false, 'Online changes close ' . (int)$m['allowed_until_hours'] . ' hours before check-in. Please contact our reservations team.'];
    return [true, ''];
}

/* ---------- output shape (identical for create, lookup and modify) ---------- */
function booking_public(PDO $pdo, array $row, bool $withToken = false): array {
    $room = booking_find_room($pdo, $row['room_id']) ?: [];
    [$cancel, $cancelWhy] = booking_can_cancel($row);
    [$modify, $modifyWhy] = booking_can_modify($row);
    $cfg = booking_config();
    $out = [
        'bookingId' => $row['booking_id'],
        'status'    => $row['booking_status'],
        'createdAt' => date('c', strtotime($row['created_at'])),
        'cancelledAt' => $row['cancelled_at'] ? date('c', strtotime($row['cancelled_at'])) : null,
        'emailStatus' => $row['email_status'],
        'room' => [
            'id' => $row['room_id'], 'name' => $row['room_name'],
            'image' => $room['image'] ?? '', 'bed' => $room['bed'] ?? '', 'size' => (int)($room['size'] ?? 0),
            'maxGuests' => (int)($room['guests'] ?? 0), 'category' => $room['category'] ?? '',
        ],
        'stay' => [
            'checkIn' => $row['check_in'], 'checkOut' => $row['check_out'], 'nights' => (int)$row['number_of_nights'],
            'adults' => (int)$row['adults'], 'children' => (int)$row['children'],
            'checkInTime' => $cfg['check_in_time'], 'checkOutTime' => $cfg['check_out_time'],
        ],
        'guest' => [
            'firstName' => $row['guest_first_name'], 'lastName' => $row['guest_last_name'], 'email' => $row['email'],
            'phoneCountry' => $row['phone_country'], 'phone' => $row['phone'], 'specialRequests' => (string)$row['special_requests'],
        ],
        'pricing' => [
            'pricePerNight' => (float)$row['price_per_night'], 'subtotal' => (float)$row['subtotal'], 'discount' => (float)$row['discount_amount'], 'couponCode' => $row['coupon_code'] ?: null, 'taxPercent' => (float)$row['tax_percent'],
            'taxAmount' => (float)$row['tax_amount'], 'total' => (float)$row['total_amount'],
        ],
        'payment' => [
            'status' => $row['payment_status'], 'method' => $row['payment_method'], 'paymentId' => $row['razorpay_payment_id'],
            'paidAmount' => $row['paid_amount'] === null ? null : (float)$row['paid_amount'], 'paidAt' => $row['paid_at'] ? date('c', strtotime($row['paid_at'])) : null,
            'refundedAmount' => (float)$row['refunded_amount'],
        ],
        'canCancel' => $cancel, 'cancelNote' => $cancelWhy, 'canModify' => $modify, 'modifyNote' => $modifyWhy,
        'policy' => ['cancellation' => $cfg['cancellation']['text'], 'payment' => $cfg['payment_note']],
    ];
    if ($withToken) $out['accessToken'] = booking_make_token($row['booking_id']);
    return $out;
}

function booking_site_url(): string {
    $u = booking_config()['site_url'];
    if ($u) return rtrim($u, '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $dir = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');
    if (basename($dir) === 'api') $dir = dirname($dir);          /* endpoints in api/bookings/ sit one level deeper */
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim($dir, '/\\');
}

/* ---------- calendar (.ics) ---------- */
function ics_escape(string $s): string { return str_replace(["\\", ';', ',', "\r\n", "\n", "\r"], ['\\\\', '\;', '\,', '\n', '\n', '\n'], $s); }
function ics_fold(string $line): string {
    $out = '';
    while (strlen($line) > 74) { $cut = 74; while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) $cut--; $out .= substr($line, 0, $cut) . "\r\n "; $line = substr($line, $cut); }
    return $out . $line;
}
function booking_ics(array $b): string {
    $cfg = booking_config();
    $lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Unicorn Hospitality//Reservations//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:' . $b['bookingId'] . '@unicorn-hospitality',
        'DTSTAMP:' . gmdate('Ymd\THis\Z'),
        'DTSTART;VALUE=DATE:' . str_replace('-', '', $b['stay']['checkIn']),
        'DTEND;VALUE=DATE:' . str_replace('-', '', $b['stay']['checkOut']),      /* all-day event, end date is exclusive = check-out day */
        'SUMMARY:' . ics_escape('Stay at ' . $cfg['hotel']['name'] . ' (' . $b['bookingId'] . ')'),
        'LOCATION:' . ics_escape($cfg['hotel']['name'] . ', ' . $cfg['hotel']['address']),
        'DESCRIPTION:' . ics_escape('Booking ' . $b['bookingId'] . ' - ' . $b['room']['name'] . '. Check-in from ' . $cfg['check_in_time'] . ', check-out by ' . $cfg['check_out_time'] . '. Reservations: ' . $cfg['contact']['phone']),
        'STATUS:' . ($b['status'] === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'),
        'END:VEVENT', 'END:VCALENDAR',
    ];
    return implode("\r\n", array_map('ics_fold', $lines)) . "\r\n";
}
