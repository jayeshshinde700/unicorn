<?php
/* Coupons: lookup, rules and the discount calculation. Coupons are created in the admin dashboard (Coupons screen).
   Usage is COUNTED from the bookings table (confirmed bookings + unpaid holds still running), so cancelling a booking gives the coupon back
   and there is no separate counter that can drift out of step. */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

function coupon_clean_code($v): string {
    return strtoupper(substr(preg_replace('/[^A-Za-z0-9_\-]/', '', v_text($v, 40)) ?? '', 0, 40));
}

function coupon_find(PDO $pdo, string $code, bool $lock = false): ?array {
    $s = $pdo->prepare('SELECT * FROM coupons WHERE code = ?' . ($lock ? ' FOR UPDATE' : ''));
    $s->execute([$code]);
    return $s->fetch() ?: null;
}

/* How many bookings currently hold/use this coupon (optionally only for one e-mail address). */
function coupon_usage(PDO $pdo, string $code, ?string $email = null, ?string $excludeBookingId = null): int {
    $sql = "SELECT COUNT(*) FROM bookings WHERE coupon_code = :c
            AND (booking_status = 'confirmed' OR (booking_status = 'pending' AND hold_expires_at IS NOT NULL AND hold_expires_at > :now))";
    $p = [':c' => $code, ':now' => date('Y-m-d H:i:s')];
    if ($email !== null) { $sql .= ' AND email = :e'; $p[':e'] = strtolower($email); }
    if ($excludeBookingId) { $sql .= ' AND booking_id <> :x'; $p[':x'] = $excludeBookingId; }
    $s = $pdo->prepare($sql);
    $s->execute($p);
    return (int)$s->fetchColumn();
}

/* 'inactive' | 'scheduled' | 'expired' | 'used_up' | 'active' - for the admin list and the public page */
function coupon_state(PDO $pdo, array $c): string {
    $today = date('Y-m-d');
    if (!(int)$c['is_active']) return 'inactive';
    if ($c['valid_from'] && $today < $c['valid_from']) return 'scheduled';
    if ($c['valid_to'] && $today > $c['valid_to']) return 'expired';
    if ($c['usage_limit'] !== null && coupon_usage($pdo, $c['code']) >= (int)$c['usage_limit']) return 'used_up';
    return 'active';
}

/* Check a code against a room + stay (+ guest e-mail when known) and work out the discount.
   Returns ['ok' => bool, 'message' => string, 'coupon' => row|null, 'discount' => float].  Messages are written for guests. */
function coupon_evaluate(PDO $pdo, string $code, array $room, array $stay, string $email = '', ?string $excludeBookingId = null): array {
    $fail = fn(string $m) => ['ok' => false, 'message' => $m, 'coupon' => null, 'discount' => 0.0];
    $code = coupon_clean_code($code);
    if ($code === '') return $fail('Please enter a coupon code.');
    $c = coupon_find($pdo, $code);
    if (!$c || !(int)$c['is_active']) return $fail('This coupon code is not valid.');

    $today = date('Y-m-d');
    if ($c['valid_from'] && $today < $c['valid_from']) return $fail('This coupon is not active yet. It starts on ' . date('d M Y', strtotime($c['valid_from'])) . '.');
    if ($c['valid_to'] && $today > $c['valid_to']) return $fail('This coupon has expired.');
    if ($c['stay_from'] && $stay['checkIn'] < $c['stay_from']) return $fail('This coupon is for stays from ' . date('d M Y', strtotime($c['stay_from'])) . '.');
    if ($c['stay_to'] && $stay['checkIn'] > $c['stay_to']) return $fail('This coupon is for stays up to ' . date('d M Y', strtotime($c['stay_to'])) . '.');
    if ($c['applies_to'] !== 'all' && ($room['category'] ?? '') !== $c['applies_to']) return $fail('This coupon is only for ' . ($c['applies_to'] === 'suite' ? 'suites' : 'rooms') . '.');
    if ($stay['nights'] < (int)$c['min_nights']) return $fail('This coupon needs a stay of at least ' . (int)$c['min_nights'] . ' nights.');

    $subtotal = round((float)($room['price'] ?? 0) * $stay['nights'], 2);
    if ($subtotal < (float)$c['min_subtotal']) return $fail('This coupon needs a booking of at least ' . booking_config()['currency_symbol'] . number_format((float)$c['min_subtotal'], 0) . '.');

    if ($c['usage_limit'] !== null && coupon_usage($pdo, $code, null, $excludeBookingId) >= (int)$c['usage_limit']) return $fail('Sorry, this coupon has been fully redeemed.');
    if ($email !== '' && coupon_usage($pdo, $code, $email, $excludeBookingId) >= (int)$c['per_email_limit']) return $fail('You have already used this coupon.');

    $discount = $c['discount_type'] === 'percent' ? $subtotal * (float)$c['discount_value'] / 100 : (float)$c['discount_value'];
    if ($c['discount_type'] === 'percent' && $c['max_discount'] !== null) $discount = min($discount, (float)$c['max_discount']);
    $discount = round(min($discount, $subtotal), 2);
    if ($discount <= 0) return $fail('This coupon does not reduce the price of this stay.');
    return ['ok' => true, 'message' => 'Coupon applied', 'coupon' => $c, 'discount' => $discount];
}

/* Short text such as "15% off (up to Rs 3,000)" or "Rs 500 off" */
function coupon_headline(array $c): string {
    $sym = booking_config()['currency_symbol'];
    if ($c['discount_type'] === 'percent') {
        $v = rtrim(rtrim(number_format((float)$c['discount_value'], 2), '0'), '.');
        return $v . '% off' . ($c['max_discount'] !== null ? ' (up to ' . $sym . number_format((float)$c['max_discount'], 0) . ')' : '');
    }
    return $sym . number_format((float)$c['discount_value'], 0) . ' off';
}

/* Conditions in plain words, for the public coupons page */
function coupon_terms(array $c): array {
    $sym = booking_config()['currency_symbol'];
    $t = [];
    if ((int)$c['min_nights'] > 1) $t[] = 'Minimum stay: ' . (int)$c['min_nights'] . ' nights';
    if ((float)$c['min_subtotal'] > 0) $t[] = 'Minimum booking: ' . $sym . number_format((float)$c['min_subtotal'], 0);
    if ($c['applies_to'] !== 'all') $t[] = 'Valid on ' . ($c['applies_to'] === 'suite' ? 'suites' : 'rooms') . ' only';
    if ($c['stay_from'] || $c['stay_to']) $t[] = 'Stay dates: ' . ($c['stay_from'] ? date('d M Y', strtotime($c['stay_from'])) : 'any') . ' to ' . ($c['stay_to'] ? date('d M Y', strtotime($c['stay_to'])) : 'any');
    if ($c['valid_to']) $t[] = 'Book before ' . date('d M Y', strtotime($c['valid_to']));
    if ((int)$c['per_email_limit'] > 0) $t[] = 'Limit ' . (int)$c['per_email_limit'] . ' use' . ((int)$c['per_email_limit'] > 1 ? 's' : '') . ' per guest';
    return $t;
}
