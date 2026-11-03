<?php
/* POST api/bookings/create.php - step 1 of 2 of a booking.
   Validates, re-checks availability inside a transaction, applies the coupon, HOLDS the room for pending_hold_minutes and creates a
   Razorpay order. The guest then pays in the Razorpay window; the reservation becomes real in api/payments/verify.php (or the webhook).
   The price is always calculated here; any total sent by the browser is ignored. */
require __DIR__ . '/../lib/response.php';
api_require_method('POST');
api_require_same_origin();

api_run(function () {
    $in = api_input();
    $cfg = booking_config();
    $pdo = db();
    api_rate_limit('create');
    if (!rzp_configured()) api_fail('Online booking is not switched on yet. Please call our reservations team to book your stay.', 503);

    /* ---- validate ---- */
    $errors = [];
    $stay = v_stay($in, $errors);
    $first = v_name($in['firstName'] ?? '', 'first name', $errors, 'firstName');
    $last = v_name($in['lastName'] ?? '', 'last name', $errors, 'lastName');
    $email = v_email($in['email'] ?? '', $errors);
    [$cc, $phone] = v_phone($in['phoneCountry'] ?? '+91', $in['phone'] ?? '', $errors);
    $requests = v_text($in['specialRequests'] ?? '', 500);
    $roomId = preg_replace('/[^a-z0-9\-]/', '', strtolower(v_text($in['roomId'] ?? '', 40)));
    $token = strtolower(v_text($in['requestToken'] ?? '', 32));
    $couponCode = coupon_clean_code($in['couponCode'] ?? '');
    if ($roomId === '') $errors['roomId'] = 'Please choose a room.';
    if (!preg_match('/^[a-f0-9]{16,32}$/', $token)) $errors['requestToken'] = 'Invalid request. Please refresh the page and try again.';
    if ($errors) api_fail('Please check the highlighted details.', 422, $errors);

    booking_expire_holds($pdo);

    /* ---- same request sent twice (double click, closed the payment window and pressed Pay again)? ---- */
    $old = $pdo->prepare('SELECT * FROM bookings WHERE request_token = ?');
    $old->execute([$token]);
    if ($row = $old->fetch()) {
        if ($row['booking_status'] === 'confirmed') api_ok('Booking confirmed', booking_public($pdo, $row, true) + ['duplicate' => true]);
        if ($row['booking_status'] === 'pending' && $row['razorpay_order_id']) {
            api_ok('Ready for payment', booking_public($pdo, $row) + ['checkout' => booking_checkout_payload($row), 'duplicate' => true]);
        }
        $pdo->prepare('UPDATE bookings SET request_token = NULL WHERE id = ?')->execute([$row['id']]);   /* old attempt is dead: start a fresh one */
    }

    /* ---- hold the room (transaction + row lock = two guests can never take the last room) ---- */
    $pdo->beginTransaction();
    try {
        $room = booking_find_room($pdo, $roomId, true);       /* locks this room's row until commit/rollback */
        if (!$room || $room['status'] !== 'published') { $pdo->rollBack(); api_fail('That room is not available for booking.', 404); }

        /* this guest's earlier unpaid attempt for the same room is replaced by this one, so they never block themselves */
        $now = date('Y-m-d H:i:s');
        $pdo->prepare("UPDATE bookings SET booking_status = 'cancelled', cancel_reason = 'replaced', cancelled_at = ?, updated_at = ?, hold_expires_at = NULL
                       WHERE booking_status = 'pending' AND payment_status = 'unpaid' AND email = ? AND room_id = ?")->execute([$now, $now, $email, $roomId]);

        $st = booking_room_status($pdo, $room, $stay, null, true);
        if (!$st['bookable']) {
            $pdo->rollBack();
            $msg = ['capacity' => 'The selected room cannot sleep this many guests. Maximum is ' . (int)$room['guests'] . '.', 'soldout' => 'The selected room is no longer available for these dates.'][$st['reason']] ?? 'The selected room is not available.';
            api_fail($msg, 409, ['roomId' => $msg]);
        }

        $discount = 0.0;
        if ($couponCode !== '') {
            coupon_find($pdo, $couponCode, true);                                   /* lock the coupon so its usage limit cannot be beaten by two guests at once */
            $c = coupon_evaluate($pdo, $couponCode, $room, $stay, $email);
            if (!$c['ok']) { $pdo->rollBack(); api_fail($c['message'], 422, ['couponCode' => $c['message']]); }
            $discount = $c['discount'];
        }
        $p = booking_price((float)$room['price'], $stay['nights'], $discount);
        $free = $p['total'] <= 0;                                                    /* a 100% coupon: nothing to pay */
        $status = $free ? 'confirmed' : 'pending';
        $hold = $free ? null : date('Y-m-d H:i:s', time() + 60 * (int)$cfg['pending_hold_minutes']);

        $ins = $pdo->prepare('INSERT INTO bookings (booking_id, request_token, room_id, room_name, guest_first_name, guest_last_name, email, phone_country, phone,
            check_in, check_out, adults, children, number_of_nights, price_per_night, subtotal, tax_percent, tax_amount, total_amount, special_requests,
            booking_status, hold_expires_at, email_status, created_at, updated_at, coupon_code, discount_amount, payment_status, payment_method, paid_amount, paid_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $bookingId = null;
        for ($try = 0; $try < 5 && !$bookingId; $try++) {            /* a clash on the unique booking_id is astronomically rare; retry anyway */
            $candidate = booking_new_id();
            try {
                $ins->execute([$candidate, $token, $roomId, mb_substr($room['name'], 0, 60), $first, $last, $email, $cc, $phone,
                    $stay['checkIn'], $stay['checkOut'], $stay['adults'], $stay['children'], $p['nights'], $p['pricePerNight'], $p['subtotal'], $p['taxPercent'], $p['taxAmount'], $p['total'],
                    $requests === '' ? null : $requests, $status, $hold, 'pending', $now, $now,
                    $discount > 0 ? $couponCode : null, $discount, $free ? 'paid' : 'unpaid', $free ? 'free' : null, $free ? 0 : null, $free ? $now : null]);
                $bookingId = $candidate;
            } catch (PDOException $e) {
                if ((int)$e->errorInfo[1] !== 1062 || stripos($e->getMessage(), 'uq_booking_id') === false) throw $e;
            }
        }
        if (!$bookingId) throw new RuntimeException('Could not generate a unique booking ID');
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    booking_log_event($pdo, $bookingId, 'guest', 'created', $roomId . ' ' . $stay['checkIn'] . ' to ' . $stay['checkOut'] . ($discount > 0 ? ', coupon ' . $couponCode : '') . '. Waiting for payment.');

    /* ---- free booking (coupon covers everything): confirm now ---- */
    if ($free) {
        booking_log_event($pdo, $bookingId, 'system', 'confirmed', 'No payment needed (coupon covers the full price)');
        booking_notify($pdo, $bookingId, 'created', true);
        api_ok('Booking confirmed', booking_public($pdo, booking_fetch($pdo, $bookingId), true), 201);
    }

    /* ---- ask Razorpay for a payment order (after the room is safely held) ---- */
    try {
        $order = rzp_create_order($p['total'], $bookingId);
        $pdo->prepare('UPDATE bookings SET razorpay_order_id = ? WHERE booking_id = ?')->execute([$order['id'], $bookingId]);
    } catch (Throwable $e) {
        api_log('create-order', $bookingId . ' | ' . $e->getMessage());
        $now = date('Y-m-d H:i:s');
        $pdo->prepare("UPDATE bookings SET booking_status = 'cancelled', cancel_reason = 'payment_error', cancelled_at = ?, updated_at = ?, hold_expires_at = NULL WHERE booking_id = ?")->execute([$now, $now, $bookingId]);
        booking_log_event($pdo, $bookingId, 'system', 'payment-error', $e->getMessage());
        api_fail('We could not start the payment. Nothing was charged. Please try again in a moment.', 502);
    }
    $row = booking_fetch($pdo, $bookingId);
    api_ok('Ready for payment', booking_public($pdo, $row) + ['checkout' => booking_checkout_payload($row)], 201);
}, 'create');
