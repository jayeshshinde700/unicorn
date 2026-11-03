<?php
/* POST api/bookings/cancel.php - body: {bookingId, email|token}. Sets booking_status = 'cancelled' (the row is kept for history).
   A cancelled booking no longer counts against room inventory, so the room is bookable again straight away. */
require __DIR__ . '/../lib/response.php';
api_require_method('POST');
api_require_same_origin();

api_run(function () {
    $in = api_input();
    $pdo = db();
    api_rate_limit('action');

    $row0 = booking_authorize($pdo, $in);
    if (!$row0) api_fail("We couldn't find a reservation matching those details. Please check your Booking ID and email address or contact our reservations team.", 404);

    $pdo->beginTransaction();
    try {
        $s = $pdo->prepare('SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE');
        $s->execute([$row0['booking_id']]);
        $row = $s->fetch();
        [$can, $why] = booking_can_cancel($row);
        if (!$can) { $pdo->rollBack(); api_fail($why, 403); }
        $now = date('Y-m-d H:i:s');
        $pdo->prepare("UPDATE bookings SET booking_status = 'cancelled', cancel_reason = 'guest', cancelled_at = ?, updated_at = ?, hold_expires_at = NULL WHERE booking_id = ?")->execute([$now, $now, $row['booking_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    booking_log_event($pdo, $row0['booking_id'], 'guest', 'cancelled', 'Cancelled online by the guest');
    /* cancelled inside the free-cancellation window (checked above) = full refund of what was paid online */
    if ($row0['payment_method'] === 'razorpay' && $row0['payment_status'] === 'paid') {
        booking_refund($pdo, booking_fetch($pdo, $row0['booking_id']), null, 'system');
    }
    booking_notify($pdo, $row0['booking_id'], 'cancelled', false);
    $done = booking_fetch($pdo, $row0['booking_id']);
    api_ok('Your reservation has been cancelled', booking_public($pdo, $done, true));
}, 'cancel');
