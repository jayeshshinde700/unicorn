<?php
/* Booking API - input validation. Every function returns the cleaned value and adds problems to $errors[field]. */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

function v_text($v, int $max): string {
    $v = is_string($v) ? $v : (is_scalar($v) ? (string)$v : '');
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

function v_name($v, string $label, array &$errors, string $key): string {
    $s = v_text($v, 60);
    if ($s === '') $errors[$key] = "Please enter your $label.";
    elseif (!preg_match("/^[\p{L}\p{M}][\p{L}\p{M} .'\-]*$/u", $s)) $errors[$key] = "Please enter a valid $label.";
    return $s;
}

function v_email($v, array &$errors, string $key = 'email'): string {
    $s = strtolower(v_text($v, 190));
    if ($s === '' || !filter_var($s, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $s)) $errors[$key] = 'Please enter a valid email address.';
    return $s;
}

/* Returns [countryCode, nationalNumber] */
function v_phone($code, $number, array &$errors, string $key = 'phone'): array {
    $codes = booking_config()['country_codes'];
    $code = v_text($code ?: '+91', 6);
    if (!isset($codes[$code])) { $errors['phoneCountry'] = 'Please choose a country code.'; $code = '+91'; }
    $digits = preg_replace('/\D/', '', v_text($number, 25)) ?? '';
    if ($code === '+91') {
        if (!preg_match('/^[6-9]\d{9}$/', $digits)) $errors[$key] = 'Please enter a valid 10-digit mobile number.';
    } elseif (strlen($digits) < 6 || strlen($digits) > 14) {
        $errors[$key] = 'Please enter a valid mobile number.';
    }
    return [$code, $digits];
}

function v_date($v, string $key, array &$errors): ?string {
    $s = v_text($v, 10);
    $d = DateTime::createFromFormat('!Y-m-d', $s);
    if (!$d || $d->format('Y-m-d') !== $s) { $errors[$key] = 'Please choose a valid date.'; return null; }
    return $s;
}

function v_int($v, int $min, int $max, string $key, string $label, array &$errors): int {
    if (is_string($v) && !preg_match('/^\d{1,3}$/', $v)) { $errors[$key] = "Please check the number of $label."; return $min; }
    $n = (int)$v;
    if ($n < $min || $n > $max) { $errors[$key] = "Please check the number of $label."; return max($min, min($max, $n)); }
    return $n;
}

/* Validate a stay: dates (not in the past, check-out after check-in, within limits) + guests. Returns the cleaned stay. */
function v_stay(array $in, array &$errors): array {
    $cfg = booking_config();
    $in_ = v_date($in['checkIn'] ?? ($in['check_in'] ?? ''), 'checkIn', $errors);
    $out = v_date($in['checkOut'] ?? ($in['check_out'] ?? ''), 'checkOut', $errors);
    $nights = 0;
    if ($in_ && $out) {
        $today = new DateTime('today');
        $a = new DateTime($in_); $b = new DateTime($out);
        if ($a < $today) $errors['checkIn'] = 'Check-in cannot be in the past.';
        elseif ($a > (clone $today)->modify('+' . (int)$cfg['max_advance_days'] . ' days')) $errors['checkIn'] = 'Bookings open up to ' . (int)$cfg['max_advance_days'] . ' days ahead.';
        if ($b <= $a) $errors['checkOut'] = 'Check-out must be at least one day after check-in.';
        else {
            $nights = (int)$a->diff($b)->days;
            if ($nights > (int)$cfg['max_nights']) $errors['checkOut'] = 'The longest online stay is ' . (int)$cfg['max_nights'] . ' nights. Please contact reservations for longer stays.';
        }
    }
    $adults = v_int($in['adults'] ?? 2, 1, (int)$cfg['max_adults'], 'adults', 'adults', $errors);
    $children = v_int($in['children'] ?? 0, 0, (int)$cfg['max_children'], 'children', 'children', $errors);
    return ['checkIn' => $in_, 'checkOut' => $out, 'nights' => $nights, 'adults' => $adults, 'children' => $children];
}
