<?php
/* Unicorn Hospitality - PUBLIC rooms feed (read only, no sign-in).
   Returns only published rooms, sorted as set in the admin, and only the fields the website needs.
     fetch('api/rooms.php')                                                  -> all rooms (used by rooms.html)
     fetch('api/rooms.php?check_in=2026-12-01&check_out=2026-12-04&adults=2&children=0&type=suite')
        -> same rooms plus, for each one, `availability` (rooms left, bookable yes/no, server-side price) and `settings`.
   Room data comes from the MySQL `rooms` table that the admin dashboard edits. */
require __DIR__ . '/lib/response.php';
api_require_method('GET', 'HEAD');

api_run(function () {
    $cfg = booking_config();
    $pdo = db();
    $in = $_GET;

    $rooms = array_values(array_filter(rooms_load(), fn($r) => ($r['status'] ?? '') === 'published'));
    $type = strtolower((string)($in['type'] ?? 'all'));
    if (in_array($type, ['room', 'suite'], true)) $rooms = array_values(array_filter($rooms, fn($r) => ($r['category'] ?? '') === $type));

    /* optional availability check for a stay */
    $stay = null;
    $hasDates = isset($in['check_in']) || isset($in['checkIn']) || isset($in['check_out']) || isset($in['checkOut']);
    if ($hasDates) {
        $errors = [];
        $stay = v_stay($in, $errors);
        if ($errors) api_fail('Please check your dates and guests.', 422, $errors);
    }

    $out = [];
    foreach ($rooms as $r) {
        $pub = room_public($r);
        $pub['inventory'] = (int)($r['inventory'] ?? 0);
        if ($stay) $pub['availability'] = booking_room_status($pdo, $r, $stay);
        $out[] = $pub;
    }

    header('Cache-Control: ' . ($stay ? 'no-store' : 'public, max-age=30'));
    $data = [
        'updated' => rooms_updated(),
        'count' => count($out),
        'rooms' => $out,
        'stay' => $stay,
        'settings' => [
            'currencySymbol' => $cfg['currency_symbol'], 'taxPercent' => (float)$cfg['tax_percent'], 'taxLabel' => $cfg['tax_label'], 'taxNote' => $cfg['tax_note'],
            'paymentNote' => $cfg['payment_note'], 'cancellationText' => $cfg['cancellation']['text'], 'maxNights' => (int)$cfg['max_nights'],
            'maxAdults' => (int)$cfg['max_adults'], 'maxChildren' => (int)$cfg['max_children'], 'maxAdvanceDays' => (int)$cfg['max_advance_days'],
            'checkInTime' => $cfg['check_in_time'], 'checkOutTime' => $cfg['check_out_time'],
            'countryCodes' => $cfg['country_codes'], 'contact' => $cfg['contact'], 'defaultStatus' => $cfg['default_status'],
        ],
    ];
    /* rooms/count/updated are repeated at the top level because rooms.html (assets/js/rooms.js) reads them there */
    api_send(true, 'Rooms loaded', $data, 200, [], ['updated' => $data['updated'], 'count' => $data['count'], 'rooms' => $data['rooms']]);
}, 'rooms');
