<?php
/* POST api/coupons/apply.php - the "Apply" button on the booking page. Shows the guest the new price. Nothing is saved:
   the coupon is checked again, with the same rules, when the booking is created.
   body: {roomId, checkIn, checkOut, adults, children, couponCode, email?} */
require __DIR__ . '/../lib/response.php';
api_require_method('POST');
api_require_same_origin();

api_run(function () {
    $in = api_input();
    $pdo = db();
    api_rate_limit('action');

    $errors = [];
    $stay = v_stay($in, $errors);
    if ($errors) api_fail('Please choose valid dates first.', 422, $errors);
    $room = booking_find_room($pdo, preg_replace('/[^a-z0-9\-]/', '', strtolower(v_text($in['roomId'] ?? '', 40))));
    if (!$room || $room['status'] !== 'published') api_fail('Please choose a room first.', 404);
    $email = strtolower(v_text($in['email'] ?? '', 190));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';

    $c = coupon_evaluate($pdo, (string)($in['couponCode'] ?? ''), $room, $stay, $email);
    if (!$c['ok']) api_fail($c['message'], 422, ['couponCode' => $c['message']]);
    $p = booking_price((float)$room['price'], $stay['nights'], $c['discount']);
    api_ok('Coupon applied', ['code' => $c['coupon']['code'], 'title' => $c['coupon']['title'], 'headline' => coupon_headline($c['coupon']), 'pricing' => $p]);
}, 'coupon-apply');
