<?php
/* GET api/bookings/calendar.php?id=UCH-XXXX&token=...  (token comes from a successful lookup)  ->  downloads a .ics calendar file */
require __DIR__ . '/../lib/response.php';
api_require_method('GET', 'POST');

api_run(function () {
    $in = api_input();
    $pdo = db();
    api_rate_limit('action');
    $row = booking_authorize($pdo, ['bookingId' => $in['id'] ?? ($in['bookingId'] ?? ''), 'token' => $in['token'] ?? '', 'email' => $in['email'] ?? '']);
    if (!$row) api_fail('This link has expired. Please find your reservation again to download the calendar file.', 403);
    $b = booking_public($pdo, $row);
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $b['bookingId'] . '.ics"');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo booking_ics($b);
    exit;
}, 'calendar');
