<?php
/* Admin dashboard: Reservations + Coupons.
   This file is loaded by admin/api.php for the actions listed in BOOKING_ADMIN_ACTIONS. By the time it runs, the admin is signed in,
   the CSRF token was checked and $body holds the JSON the screen sent. Every branch ends with json_out(), so nothing else runs.
   The screens that call these actions are in admin/assets/admin-bookings.js.

   Business rules (prices, refunds, e-mails) are NOT repeated here: they live in api/lib/*.php and are shared with the public booking pages. */

if (!defined('UCH_BOOKING')) define('UCH_BOOKING', true);
require_once dirname(__DIR__, 2) . '/api/lib/response.php';

const BOOKING_ADMIN_ACTIONS = ['reservations', 'reservation', 'reservation_save', 'reservation_cancel', 'reservation_markpaid', 'reservation_refund',
    'reservation_resend', 'reservations_export', 'coupons', 'coupon_save', 'coupon_toggle', 'coupon_delete'];

if (!in_array($action, BOOKING_ADMIN_ACTIONS, true)) return;      /* not a Reservations/Coupons action: nothing to do here */

/* ---------- shapes sent to the screens ---------- */
function adm_booking(array $r): array {
    $abandoned = $r['booking_status'] === 'cancelled' && in_array($r['cancel_reason'] ?? '', BOOKING_ABANDONED, true);
    $awaiting = $r['booking_status'] === 'pending';
    return [
        'id' => $r['booking_id'], 'status' => $abandoned ? 'abandoned' : ($awaiting ? 'awaiting' : $r['booking_status']),
        'cancelReason' => $r['cancel_reason'], 'room' => $r['room_name'], 'roomId' => $r['room_id'],
        'firstName' => $r['guest_first_name'], 'lastName' => $r['guest_last_name'], 'email' => $r['email'],
        'phoneCountry' => $r['phone_country'], 'phone' => $r['phone'],
        'checkIn' => $r['check_in'], 'checkOut' => $r['check_out'], 'nights' => (int)$r['number_of_nights'],
        'adults' => (int)$r['adults'], 'children' => (int)$r['children'],
        'pricePerNight' => (float)$r['price_per_night'], 'subtotal' => (float)$r['subtotal'], 'discount' => (float)$r['discount_amount'], 'coupon' => $r['coupon_code'],
        'taxAmount' => (float)$r['tax_amount'], 'total' => (float)$r['total_amount'],
        'paymentStatus' => $r['payment_status'], 'paymentMethod' => $r['payment_method'], 'paymentId' => $r['razorpay_payment_id'], 'orderId' => $r['razorpay_order_id'],
        'paidAmount' => $r['paid_amount'] === null ? null : (float)$r['paid_amount'], 'paidAt' => $r['paid_at'],
        'refunded' => (float)$r['refunded_amount'], 'refundId' => $r['refund_id'],
        'requests' => (string)$r['special_requests'], 'notes' => (string)$r['admin_notes'], 'emailStatus' => $r['email_status'],
        'holdExpiresAt' => $r['hold_expires_at'], 'createdAt' => $r['created_at'], 'updatedAt' => $r['updated_at'], 'cancelledAt' => $r['cancelled_at'],
    ];
}

function adm_booking_row(PDO $pdo, $id): array {
    $row = booking_fetch($pdo, booking_clean_id($id));
    if (!$row) json_out(['ok' => false, 'error' => 'That reservation was not found.'], 404);
    return $row;
}

function adm_events(PDO $pdo, string $id): array {
    $s = $pdo->prepare('SELECT created_at, actor, event, detail FROM booking_events WHERE booking_id = ? ORDER BY id DESC LIMIT 100');
    $s->execute([$id]);
    return array_map(fn($e) => ['at' => $e['created_at'], 'actor' => $e['actor'], 'event' => $e['event'], 'detail' => $e['detail']], $s->fetchAll());
}

function adm_coupon(PDO $pdo, array $c): array {
    return [
        'id' => (int)$c['id'], 'code' => $c['code'], 'title' => $c['title'], 'description' => $c['description'],
        'type' => $c['discount_type'], 'value' => (float)$c['discount_value'], 'maxDiscount' => $c['max_discount'] === null ? null : (float)$c['max_discount'],
        'minSubtotal' => (float)$c['min_subtotal'], 'minNights' => (int)$c['min_nights'], 'appliesTo' => $c['applies_to'],
        'validFrom' => $c['valid_from'], 'validTo' => $c['valid_to'], 'stayFrom' => $c['stay_from'], 'stayTo' => $c['stay_to'],
        'usageLimit' => $c['usage_limit'] === null ? null : (int)$c['usage_limit'], 'perEmailLimit' => (int)$c['per_email_limit'],
        'active' => (bool)$c['is_active'], 'public' => (bool)$c['is_public'],
        'state' => coupon_state($pdo, $c), 'used' => coupon_usage($pdo, $c['code']), 'headline' => coupon_headline($c),
    ];
}

function adm_date($v, string $label, array &$errors, string $key, bool $required = false): ?string {
    $s = v_text($v, 10);
    if ($s === '') { if ($required) $errors[$key] = "Choose the $label."; return null; }
    $d = DateTime::createFromFormat('!Y-m-d', $s);
    if (!$d || $d->format('Y-m-d') !== $s) { $errors[$key] = "That $label is not a valid date."; return null; }
    return $s;
}

function adm_nullable_num($v, array &$errors, string $key, string $label, float $min = 0): ?float {
    if ($v === null || $v === '') return null;
    if (!is_numeric($v) || (float)$v < $min) { $errors[$key] = "$label must be a number" . ($min > 0 ? " of at least $min" : '') . '.'; return null; }
    return round((float)$v, 2);
}

$pdo = db();
booking_ensure_schema($pdo);
$actor = 'admin:' . $user['username'];

switch ($action) {

    /* ================= RESERVATIONS ================= */
    case 'reservations':
        booking_expire_holds($pdo);
        $filter = (string)($_GET['status'] ?? 'all');
        $q = trim((string)($_GET['q'] ?? ''));
        $today = date('Y-m-d');
        $where = []; $args = [];
        $abandonedList = "'" . implode("','", BOOKING_ABANDONED) . "'";
        $notAbandoned = "NOT (booking_status = 'cancelled' AND cancel_reason IN ($abandonedList))";
        switch ($filter) {
            case 'upcoming':  $where[] = "booking_status = 'confirmed' AND check_out >= ?"; $args[] = $today; break;
            case 'arrivals':  $where[] = "booking_status = 'confirmed' AND check_in = ?"; $args[] = $today; break;
            case 'awaiting':  $where[] = "booking_status = 'pending'"; break;
            case 'confirmed': $where[] = "booking_status = 'confirmed'"; break;
            case 'cancelled': $where[] = "booking_status = 'cancelled' AND $notAbandoned"; break;
            case 'abandoned': $where[] = "booking_status = 'cancelled' AND cancel_reason IN ($abandonedList)"; break;
            case 'attention': $where[] = "(payment_status = 'refund_failed' OR (booking_status = 'confirmed' AND payment_status = 'unpaid'))"; break;
            default:          $where[] = $notAbandoned;
        }
        if ($q !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
            $where[] = "(booking_id LIKE ? OR CONCAT(guest_first_name, ' ', guest_last_name) LIKE ? OR email LIKE ? OR phone LIKE ? OR razorpay_payment_id LIKE ?)";
            array_push($args, $like, $like, $like, $like, $like);
        }
        $s = $pdo->prepare('SELECT * FROM bookings WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC, id DESC LIMIT 300');
        $s->execute($args);
        $list = array_map('adm_booking', $s->fetchAll());

        $one = fn(string $sql, array $a = []) => (function () use ($pdo, $sql, $a) { $st = $pdo->prepare($sql); $st->execute($a); return $st->fetchColumn(); })();
        $month = date('Y-m') . '-01 00:00:00';
        $stats = [
            'upcoming' => (int)$one("SELECT COUNT(*) FROM bookings WHERE booking_status = 'confirmed' AND check_out >= ?", [$today]),
            'arrivals' => (int)$one("SELECT COUNT(*) FROM bookings WHERE booking_status = 'confirmed' AND check_in = ?", [$today]),
            'awaiting' => (int)$one("SELECT COUNT(*) FROM bookings WHERE booking_status = 'pending'"),
            'attention' => (int)$one("SELECT COUNT(*) FROM bookings WHERE payment_status = 'refund_failed' OR (booking_status = 'confirmed' AND payment_status = 'unpaid')"),
            'revenueMonth' => (float)$one("SELECT COALESCE(SUM(paid_amount - refunded_amount), 0) FROM bookings WHERE paid_at >= ? AND payment_method <> 'free'", [$month]),
        ];
        json_out(['ok' => true, 'reservations' => $list, 'stats' => $stats]);

    case 'reservation':
        $row = adm_booking_row($pdo, $_GET['id'] ?? '');
        $room = booking_find_room($pdo, $row['room_id']) ?: [];
        json_out(['ok' => true, 'reservation' => adm_booking($row), 'events' => adm_events($pdo, $row['booking_id']),
            'roomImage' => $room['image'] ?? '', 'currency' => booking_config()['currency_symbol']]);

    case 'reservation_save':
        $row = adm_booking_row($pdo, $body['id'] ?? '');
        $errors = [];
        $first = v_name($body['firstName'] ?? '', 'first name', $errors, 'firstName');
        $last = v_name($body['lastName'] ?? '', 'last name', $errors, 'lastName');
        $email = v_email($body['email'] ?? '', $errors);
        [$cc, $phone] = v_phone($body['phoneCountry'] ?? '+91', $body['phone'] ?? '', $errors);
        $in = adm_date($body['checkIn'] ?? '', 'check-in date', $errors, 'checkIn', true);
        $out = adm_date($body['checkOut'] ?? '', 'check-out date', $errors, 'checkOut', true);
        $adults = v_int($body['adults'] ?? 1, 1, 12, 'adults', 'adults', $errors);
        $children = v_int($body['children'] ?? 0, 0, 10, 'children', 'children', $errors);
        $requests = v_text($body['specialRequests'] ?? '', 500);
        $notes = v_text($body['adminNotes'] ?? '', 2000);
        $nights = 0;
        if ($in && $out) {
            if ($out <= $in) $errors['checkOut'] = 'Check-out must be after check-in.';
            else $nights = (int)(new DateTime($in))->diff(new DateTime($out))->days;
            if ($nights > 90) $errors['checkOut'] = 'The longest stay you can set here is 90 nights.';
        }
        if ($errors) fail_fields($errors);

        $pdo->beginTransaction();
        try {
            $room = booking_find_room($pdo, $row['room_id'], true);
            $s = $pdo->prepare('SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE');
            $s->execute([$row['booking_id']]);
            $row = $s->fetch();
            $active = in_array($row['booking_status'], ['confirmed', 'pending'], true);
            if ($active && $room) {      /* the room must still be free for the new dates (this booking does not count against itself) */
                $stay = ['checkIn' => $in, 'checkOut' => $out, 'adults' => $adults, 'children' => $children, 'nights' => $nights];
                $st = booking_room_status($pdo, array_merge($room, ['status' => 'published', 'price' => (float)$row['price_per_night']]), $stay, $row['booking_id'], true);
                if (!$st['bookable']) {
                    $pdo->rollBack();
                    $m = $st['reason'] === 'capacity' ? 'This room sleeps up to ' . (int)$room['guests'] . ' guests.' : 'This room is fully booked on those dates.';
                    json_out(['ok' => false, 'error' => $m, 'errors' => ['checkIn' => $m]], 409);
                }
            }
            /* keep the booked nightly rate and coupon amount; only the number of nights can change the money */
            $rate = (float)$row['price_per_night'];
            $subtotal = round($rate * $nights, 2);
            $discount = min((float)$row['discount_amount'], $subtotal);
            $tax = (float)$row['tax_percent'] > 0 ? round(($subtotal - $discount) * (float)$row['tax_percent'] / 100, 2) : 0.0;
            $total = round($subtotal - $discount + $tax, 2);
            $changes = [];
            foreach (['check_in' => $in, 'check_out' => $out, 'adults' => $adults, 'children' => $children, 'email' => $email, 'phone' => $phone,
                      'guest_first_name' => $first, 'guest_last_name' => $last, 'special_requests' => $requests] as $col => $new) {
                if ((string)$row[$col] !== (string)$new) $changes[] = str_replace('_', ' ', $col);
            }
            if ((string)$row['admin_notes'] !== $notes) $changes[] = 'internal notes';
            $pdo->prepare('UPDATE bookings SET guest_first_name=?, guest_last_name=?, email=?, phone_country=?, phone=?, check_in=?, check_out=?, adults=?, children=?, number_of_nights=?,
                    subtotal=?, discount_amount=?, tax_amount=?, total_amount=?, special_requests=?, admin_notes=?, updated_at=? WHERE booking_id=?')
                ->execute([$first, $last, $email, $cc, $phone, $in, $out, $adults, $children, $nights, $subtotal, $discount, $tax, $total,
                    $requests === '' ? null : $requests, $notes === '' ? null : $notes, date('Y-m-d H:i:s'), $row['booking_id']]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
        $msg = $changes ? implode(', ', $changes) : 'no field changed';
        $diff = abs($total - (float)$row['total_amount']) > 0.009;
        if ($diff) $msg .= '. Total changed from ' . number_format((float)$row['total_amount'], 2) . ' to ' . number_format($total, 2) . ($row['payment_status'] === 'paid' ? ' (guest already paid: settle the difference manually)' : '');
        booking_log_event($pdo, $row['booking_id'], $actor, 'edited', $msg);
        log_activity('reservation-edited', $row['booking_id']);
        if (!empty($body['notifyGuest'])) booking_notify($pdo, $row['booking_id'], 'modified', false);
        json_out(['ok' => true, 'reservation' => adm_booking(booking_fetch($pdo, $row['booking_id'])), 'events' => adm_events($pdo, $row['booking_id']),
            'priceChanged' => $diff]);

    case 'reservation_cancel':
        $row = adm_booking_row($pdo, $body['id'] ?? '');
        if ($row['booking_status'] === 'cancelled') json_out(['ok' => false, 'error' => 'This reservation is already cancelled.'], 409);
        $now = date('Y-m-d H:i:s');
        $pdo->prepare("UPDATE bookings SET booking_status = 'cancelled', cancel_reason = 'admin', cancelled_at = ?, updated_at = ?, hold_expires_at = NULL WHERE booking_id = ?")->execute([$now, $now, $row['booking_id']]);
        booking_log_event($pdo, $row['booking_id'], $actor, 'cancelled', 'Cancelled by the hotel' . (!empty($body['reason']) ? ': ' . v_text($body['reason'], 150) : ''));
        log_activity('reservation-cancelled', $row['booking_id']);
        $refundMsg = '';
        if (!empty($body['refund']) && $row['payment_method'] === 'razorpay' && $row['payment_status'] === 'paid') {
            [$ok, $refundMsg] = booking_refund($pdo, booking_fetch($pdo, $row['booking_id']), null, $actor);
        }
        if (!empty($body['notifyGuest']) && $row['booking_status'] === 'confirmed') booking_notify($pdo, $row['booking_id'], 'cancelled', false);
        json_out(['ok' => true, 'reservation' => adm_booking(booking_fetch($pdo, $row['booking_id'])), 'events' => adm_events($pdo, $row['booking_id']), 'refundMessage' => $refundMsg]);

    case 'reservation_markpaid':       /* money received outside Razorpay (cash, bank transfer, pay at hotel) */
        $row = adm_booking_row($pdo, $body['id'] ?? '');
        if ($row['payment_status'] === 'paid' || !in_array($row['booking_status'], ['confirmed', 'pending'], true)) json_out(['ok' => false, 'error' => 'This reservation cannot be marked as paid.'], 409);
        $now = date('Y-m-d H:i:s');
        $pdo->prepare("UPDATE bookings SET booking_status = 'confirmed', hold_expires_at = NULL, payment_status = 'paid', payment_method = 'manual', paid_amount = total_amount, paid_at = ?, updated_at = ? WHERE booking_id = ?")->execute([$now, $now, $row['booking_id']]);
        booking_log_event($pdo, $row['booking_id'], $actor, 'marked-paid', 'Payment received outside Razorpay (cash / transfer). Reservation confirmed.');
        log_activity('reservation-paid', $row['booking_id']);
        if ($row['booking_status'] === 'pending') booking_notify($pdo, $row['booking_id'], 'created', false);
        json_out(['ok' => true, 'reservation' => adm_booking(booking_fetch($pdo, $row['booking_id'])), 'events' => adm_events($pdo, $row['booking_id'])]);

    case 'reservation_refund':
        $row = adm_booking_row($pdo, $body['id'] ?? '');
        $amount = isset($body['amount']) && $body['amount'] !== '' ? (float)$body['amount'] : null;
        [$ok, $msg] = booking_refund($pdo, $row, $amount, $actor);
        if (!$ok) json_out(['ok' => false, 'error' => $msg], 422);
        log_activity('reservation-refunded', $row['booking_id']);
        json_out(['ok' => true, 'message' => $msg, 'reservation' => adm_booking(booking_fetch($pdo, $row['booking_id'])), 'events' => adm_events($pdo, $row['booking_id'])]);

    case 'reservation_resend':
        $row = adm_booking_row($pdo, $body['id'] ?? '');
        if (in_array($row['booking_status'], ['pending'], true)) json_out(['ok' => false, 'error' => 'This reservation is not confirmed yet.'], 409);
        $kind = $row['booking_status'] === 'cancelled' ? 'cancelled' : 'created';
        $status = booking_notify($pdo, $row['booking_id'], $kind, false);
        json_out(['ok' => $status === 'sent', 'error' => $status === 'sent' ? '' : 'The e-mail could not be sent (' . $status . '). See api/storage/logs for the reason.',
            'reservation' => adm_booking(booking_fetch($pdo, $row['booking_id'])), 'events' => adm_events($pdo, $row['booking_id'])], $status === 'sent' ? 200 : 502);

    case 'reservations_export':
        $rows = $pdo->query('SELECT * FROM bookings ORDER BY created_at DESC, id DESC')->fetchAll();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="unicorn-reservations-' . date('Y-m-d') . '.csv"');
        $f = fopen('php://output', 'w');
        fwrite($f, "\xEF\xBB\xBF");                                    /* so Excel reads accents and the rupee sign correctly */
        fputcsv($f, ['Booking ID', 'Status', 'Booked on', 'Guest', 'Email', 'Phone', 'Room', 'Check-in', 'Check-out', 'Nights', 'Adults', 'Children', 'Room charges', 'Coupon', 'Discount', 'Tax', 'Total', 'Payment', 'Method', 'Razorpay payment ID', 'Paid', 'Refunded', 'Requests', 'Internal notes']);
        $safe = fn($v) => is_string($v) && preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v;      /* stops spreadsheet formula injection */
        foreach ($rows as $r) {
            $a = adm_booking($r);
            fputcsv($f, array_map($safe, [$a['id'], $a['status'], $a['createdAt'], $a['firstName'] . ' ' . $a['lastName'], $a['email'], $a['phoneCountry'] . ' ' . $a['phone'], $a['room'], $a['checkIn'], $a['checkOut'],
                $a['nights'], $a['adults'], $a['children'], $a['subtotal'], $a['coupon'], $a['discount'], $a['taxAmount'], $a['total'], $a['paymentStatus'], $a['paymentMethod'], $a['paymentId'], $a['paidAmount'], $a['refunded'], $a['requests'], $a['notes']]));
        }
        fclose($f);
        log_activity('exported', 'Reservations downloaded');
        exit;

    /* ================= COUPONS ================= */
    case 'coupons':
        $list = array_map(fn($c) => adm_coupon($pdo, $c), $pdo->query('SELECT * FROM coupons ORDER BY created_at DESC, id DESC')->fetchAll());
        json_out(['ok' => true, 'coupons' => $list]);

    case 'coupon_save':
        $in = $body['coupon'] ?? null;
        if (!is_array($in)) json_out(['ok' => false, 'error' => 'No coupon data was sent.'], 400);
        $id = (int)($in['id'] ?? 0);
        $errors = [];
        $code = coupon_clean_code($in['code'] ?? '');
        if (strlen($code) < 3) $errors['code'] = 'Use 3 to 40 letters or numbers, e.g. DIWALI15.';
        $title = v_text($in['title'] ?? '', 120);
        if ($title === '') $errors['title'] = 'Give the offer a name guests will see.';
        $type = ($in['type'] ?? '') === 'flat' ? 'flat' : 'percent';
        $value = adm_nullable_num($in['value'] ?? null, $errors, 'value', 'The discount', 0.01);
        if ($value === null && !isset($errors['value'])) $errors['value'] = 'Enter the discount.';
        if ($type === 'percent' && $value !== null && $value > 100) $errors['value'] = 'A percentage cannot be more than 100.';
        $max = $type === 'percent' ? adm_nullable_num($in['maxDiscount'] ?? null, $errors, 'maxDiscount', 'The cap', 1) : null;
        $minSub = adm_nullable_num($in['minSubtotal'] ?? null, $errors, 'minSubtotal', 'The minimum booking amount') ?? 0.0;
        $minNights = max(1, min(30, (int)($in['minNights'] ?? 1)));
        $applies = in_array($in['appliesTo'] ?? 'all', ['all', 'room', 'suite'], true) ? ($in['appliesTo'] ?? 'all') : 'all';
        $vFrom = adm_date($in['validFrom'] ?? '', 'start date', $errors, 'validFrom');
        $vTo = adm_date($in['validTo'] ?? '', 'end date', $errors, 'validTo');
        $sFrom = adm_date($in['stayFrom'] ?? '', 'stay start date', $errors, 'stayFrom');
        $sTo = adm_date($in['stayTo'] ?? '', 'stay end date', $errors, 'stayTo');
        if ($vFrom && $vTo && $vTo < $vFrom) $errors['validTo'] = 'The end date is before the start date.';
        if ($sFrom && $sTo && $sTo < $sFrom) $errors['stayTo'] = 'The end date is before the start date.';
        $limit = ($in['usageLimit'] ?? '') === '' || $in['usageLimit'] === null ? null : max(1, (int)$in['usageLimit']);
        $perEmail = max(1, min(50, (int)($in['perEmailLimit'] ?? 1)));
        if ($errors) fail_fields($errors);
        $desc = v_text($in['description'] ?? '', 400);
        $now = date('Y-m-d H:i:s');
        try {
            if ($id) {
                $s = $pdo->prepare('SELECT code FROM coupons WHERE id = ?');
                $s->execute([$id]);
                $oldCode = $s->fetchColumn();
                if ($oldCode === false) json_out(['ok' => false, 'error' => 'That coupon no longer exists.'], 404);
                if ($oldCode !== $code && coupon_usage($pdo, $oldCode) > 0) fail_fields(['code' => 'This code has already been used on bookings, so it cannot be renamed. Switch it off and create a new one.']);
                $pdo->prepare('UPDATE coupons SET code=?, title=?, description=?, discount_type=?, discount_value=?, max_discount=?, min_subtotal=?, min_nights=?, applies_to=?, valid_from=?, valid_to=?, stay_from=?, stay_to=?,
                        usage_limit=?, per_email_limit=?, is_active=?, is_public=?, updated_at=? WHERE id=?')
                    ->execute([$code, $title, $desc, $type, $value, $max, $minSub, $minNights, $applies, $vFrom, $vTo, $sFrom, $sTo, $limit, $perEmail, empty($in['active']) ? 0 : 1, empty($in['public']) ? 0 : 1, $now, $id]);
            } else {
                $pdo->prepare('INSERT INTO coupons (code, title, description, discount_type, discount_value, max_discount, min_subtotal, min_nights, applies_to, valid_from, valid_to, stay_from, stay_to,
                        usage_limit, per_email_limit, is_active, is_public, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$code, $title, $desc, $type, $value, $max, $minSub, $minNights, $applies, $vFrom, $vTo, $sFrom, $sTo, $limit, $perEmail, empty($in['active']) ? 0 : 1, empty($in['public']) ? 0 : 1, $now, $now]);
                $id = (int)$pdo->lastInsertId();
            }
        } catch (PDOException $e) {
            if ((int)$e->errorInfo[1] === 1062) fail_fields(['code' => 'A coupon with this code already exists.']);
            throw $e;
        }
        log_activity(!empty($in['id']) ? 'coupon-updated' : 'coupon-created', $code);
        $s = $pdo->prepare('SELECT * FROM coupons WHERE id = ?');
        $s->execute([$id]);
        json_out(['ok' => true, 'coupon' => adm_coupon($pdo, $s->fetch())]);

    case 'coupon_toggle':
        $s = $pdo->prepare('SELECT * FROM coupons WHERE id = ?');
        $s->execute([(int)($body['id'] ?? 0)]);
        $c = $s->fetch();
        if (!$c) json_out(['ok' => false, 'error' => 'Coupon not found.'], 404);
        $pdo->prepare('UPDATE coupons SET is_active = ?, updated_at = ? WHERE id = ?')->execute([$c['is_active'] ? 0 : 1, date('Y-m-d H:i:s'), $c['id']]);
        log_activity($c['is_active'] ? 'coupon-off' : 'coupon-on', $c['code']);
        $c['is_active'] = $c['is_active'] ? 0 : 1;
        json_out(['ok' => true, 'coupon' => adm_coupon($pdo, $c)]);

    case 'coupon_delete':
        $s = $pdo->prepare('SELECT code FROM coupons WHERE id = ?');
        $s->execute([(int)($body['id'] ?? 0)]);
        $code = $s->fetchColumn();
        if ($code === false) json_out(['ok' => false, 'error' => 'Coupon not found.'], 404);
        $pdo->prepare('DELETE FROM coupons WHERE id = ?')->execute([(int)$body['id']]);   /* old bookings keep their coupon code and discount as history */
        log_activity('coupon-deleted', $code);
        json_out(['ok' => true]);
}
