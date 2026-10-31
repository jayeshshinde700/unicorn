<?php
/* POST api/bookings/create.php - validates, re-checks availability inside a transaction and saves a booking.
   The price is always calculated here; any total sent by the browser is ignored. */
require __DIR__ . '/../lib/response.php';
api_require_method('POST');
api_require_same_origin();

api_run(function () {
    $in = api_input();
    $cfg = booking_config();
    $pdo = db();
    api_rate_limit('create');

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
    if ($roomId === '') $errors['roomId'] = 'Please choose a room.';
    if (!preg_match('/^[a-f0-9]{16,32}$/', $token)) $errors['requestToken'] = 'Invalid request. Please refresh the page and try again.';
    if ($errors) api_fail('Please check the highlighted details.', 422, $errors);

    /* ---- already saved? (same request sent twice: double click, refresh, retry) ---- */
    $s = $pdo->prepare('SELECT * FROM bookings WHERE request_token = ?');
    $s->execute([$token]);
    if ($row = $s->fetch()) {
        api_ok('Booking created successfully', booking_public($pdo, $row, true) + ['duplicate' => true]);
    }

    /* ---- save (transaction + row lock = two guests can never take the last room) ---- */
    $pdo->beginTransaction();
    try {
        $room = booking_find_room($pdo, $roomId, true);       /* locks this room's row until commit/rollback */
        if (!$room || $room['status'] !== 'published') { $pdo->rollBack(); api_fail('That room is not available for booking.', 404); }
        $st = booking_room_status($pdo, $room, $stay, null, true);
        if (!$st['bookable']) {
            $pdo->rollBack();
            $msg = ['capacity' => 'The selected room cannot sleep this many guests. Maximum is ' . (int)$room['guests'] . '.', 'soldout' => 'The selected room is no longer available for these dates.'][$st['reason']] ?? 'The selected room is not available.';
            api_fail($msg, 409, ['roomId' => $msg]);
        }
        $p = $st['quote'];
        $status = $cfg['default_status'] === 'pending' ? 'pending' : 'confirmed';
        $hold = $status === 'pending' ? date('Y-m-d H:i:s', time() + 60 * (int)$cfg['pending_hold_minutes']) : null;
        $now = date('Y-m-d H:i:s');

        $ins = $pdo->prepare('INSERT INTO bookings (booking_id, request_token, room_id, room_name, guest_first_name, guest_last_name, email, phone_country, phone,
            check_in, check_out, adults, children, number_of_nights, price_per_night, subtotal, tax_percent, tax_amount, total_amount, special_requests,
            booking_status, hold_expires_at, email_status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $bookingId = null;
        for ($try = 0; $try < 5 && !$bookingId; $try++) {            /* a clash on the unique booking_id is astronomically rare; retry anyway */
            $candidate = booking_new_id();
            try {
                $ins->execute([$candidate, $token, $roomId, mb_substr($room['name'], 0, 60), $first, $last, $email, $cc, $phone,
                    $stay['checkIn'], $stay['checkOut'], $stay['adults'], $stay['children'], $p['nights'], $p['pricePerNight'], $p['subtotal'], $p['taxPercent'], $p['taxAmount'], $p['total'],
                    $requests === '' ? null : $requests, $status, $hold, 'pending', $now, $now]);
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

    /* ---- email (after the booking is safely saved; a failure here does not undo it) ---- */
    $s = $pdo->prepare('SELECT * FROM bookings WHERE booking_id = ?');
    $s->execute([$bookingId]);
    $row = $s->fetch();
    $pub = booking_public($pdo, $row);
    $mailStatus = booking_send_email($pub, 'created');
    $pdo->prepare('UPDATE bookings SET email_status = ? WHERE booking_id = ?')->execute([$mailStatus, $bookingId]);
    $row['email_status'] = $mailStatus;

    api_ok('Booking created successfully', booking_public($pdo, $row, true), 201);
}, 'create');
