<?php
/* POST api/bookings/modify.php - change dates, guests, phone or special requests of an existing booking.
   body: {bookingId, email|token, checkIn, checkOut, adults, children, phoneCountry, phone, specialRequests, preview}
   preview=true only calculates availability and the new price (nothing is saved). The room itself cannot be changed here: make a new booking instead. */
require __DIR__ . '/../lib/response.php';
api_require_method('POST');
api_require_same_origin();

api_run(function () {
    $in = api_input();
    $pdo = db();
    $cfg = booking_config();
    api_rate_limit('action');

    $row0 = booking_authorize($pdo, $in);
    if (!$row0) api_fail("We couldn't find a reservation matching those details. Please check your Booking ID and email address or contact our reservations team.", 404);
    [$can, $why] = booking_can_modify($row0);
    if (!$can) api_fail($why, 403);

    $errors = [];
    $stay = v_stay($in, $errors);
    [$cc, $phone] = v_phone($in['phoneCountry'] ?? $row0['phone_country'], $in['phone'] ?? $row0['phone'], $errors);
    $requests = v_text($in['specialRequests'] ?? '', 500);
    if ($errors) api_fail('Please check the highlighted details.', 422, $errors);
    $preview = !empty($in['preview']);

    $pdo->beginTransaction();
    try {
        $room = booking_find_room($pdo, $row0['room_id'], true);
        if (!$room || $room['status'] !== 'published') { $pdo->rollBack(); api_fail('This room is no longer bookable online. Please contact reservations.', 409); }
        $row = $pdo->prepare('SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE');
        $row->execute([$row0['booking_id']]);
        $row = $row->fetch();
        [$can, $why] = booking_can_modify($row);                       /* re-check with the locked, latest copy */
        if (!$can) { $pdo->rollBack(); api_fail($why, 403); }

        $nightly = !empty($cfg['modification']['reprice_at_current_rate']) ? (float)$room['price'] : (float)$row['price_per_night'];
        $st = booking_room_status($pdo, array_merge($room, ['price' => $nightly]), $stay, $row['booking_id'], true);   /* this booking does not count against itself */
        if (!$st['bookable']) {
            $pdo->rollBack();
            $msg = ['capacity' => 'This room cannot sleep this many guests. Maximum is ' . (int)$room['guests'] . '.', 'soldout' => 'This room is not available for the new dates.'][$st['reason']] ?? 'Those changes are not possible.';
            api_fail($msg, 409, ['checkIn' => $msg]);
        }
        $p = $st['quote'];
        /* The guest has already paid. Online changes may not change the price (e.g. same number of nights); a different price needs the hotel. */
        if ($row['payment_status'] === 'paid' && abs($p['subtotal'] - (float)$row['subtotal']) > 0.009) {
            $pdo->rollBack();
            api_fail('This change would alter the price of your paid booking. Please keep the same number of nights, or contact our reservations team to change it.', 409, ['checkIn' => 'The number of nights must stay the same.']);
        }
        /* keep the paid price, coupon discount and tax exactly as they were */
        $p = ['pricePerNight' => (float)$row['price_per_night'], 'nights' => $p['nights'], 'subtotal' => (float)$row['subtotal'], 'taxPercent' => (float)$row['tax_percent'], 'taxAmount' => (float)$row['tax_amount'], 'total' => (float)$row['total_amount']];

        if ($preview) {
            $pdo->rollBack();
            api_ok('Changes can be made', ['pricing' => ['pricePerNight' => $p['pricePerNight'], 'nights' => $p['nights'], 'subtotal' => $p['subtotal'], 'taxPercent' => $p['taxPercent'], 'taxAmount' => $p['taxAmount'], 'total' => $p['total']],
                'previousTotal' => (float)$row['total_amount']]);
        }

        $pdo->prepare('UPDATE bookings SET check_in=?, check_out=?, adults=?, children=?, number_of_nights=?, price_per_night=?, subtotal=?, tax_percent=?, tax_amount=?, total_amount=?,
                phone_country=?, phone=?, special_requests=?, hold_expires_at = IF(booking_status = \'pending\', hold_expires_at, NULL), updated_at=? WHERE booking_id=?')
            ->execute([$stay['checkIn'], $stay['checkOut'], $stay['adults'], $stay['children'], $p['nights'], $p['pricePerNight'], $p['subtotal'], $p['taxPercent'], $p['taxAmount'], $p['total'],
                $cc, $phone, $requests === '' ? null : $requests, date('Y-m-d H:i:s'), $row['booking_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    booking_log_event($pdo, $row0['booking_id'], 'guest', 'modified', 'Changed online: ' . $stay['checkIn'] . ' to ' . $stay['checkOut'] . ', ' . $stay['adults'] . ' adults, ' . $stay['children'] . ' children');
    booking_notify($pdo, $row0['booking_id'], 'modified', false);
    $updated = booking_fetch($pdo, $row0['booking_id']);
    api_ok('Your reservation has been updated', booking_public($pdo, $updated, true));
}, 'modify');
