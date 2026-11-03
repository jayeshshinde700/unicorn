<?php
/* Payments for bookings: what happens when Razorpay says "paid", and refunds.
   A booking becomes a real reservation ONLY inside booking_confirm_payment(). Both the browser (verify.php) and Razorpay's
   server (webhook.php) call it, so it is safe to run twice for the same payment. */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

/* What the browser needs to open the Razorpay payment window */
function booking_checkout_payload(array $row): array {
    $cfg = booking_config();
    return [
        'keyId' => $cfg['razorpay']['key_id'], 'orderId' => $row['razorpay_order_id'],
        'amount' => rzp_paise((float)$row['total_amount']), 'currency' => 'INR',
        'name' => $cfg['hotel']['name'], 'themeColor' => $cfg['razorpay']['theme_color'],
        'description' => $row['room_name'] . ', ' . $row['number_of_nights'] . ' night' . ($row['number_of_nights'] > 1 ? 's' : ''),
        'prefill' => ['name' => $row['guest_first_name'] . ' ' . $row['guest_last_name'], 'email' => $row['email'], 'contact' => $row['phone_country'] . $row['phone']],
        'holdExpiresAt' => $row['hold_expires_at'] ? date('c', strtotime($row['hold_expires_at'])) : null,
    ];
}

function booking_fetch(PDO $pdo, string $bookingId): ?array {
    $s = $pdo->prepare('SELECT * FROM bookings WHERE booking_id = ?');
    $s->execute([$bookingId]);
    return $s->fetch() ?: null;
}

/* Send the e-mails for a booking and remember the result in bookings.email_status. Never throws. */
function booking_notify(PDO $pdo, string $bookingId, string $kind, bool $alsoHotel = false): string {
    $row = booking_fetch($pdo, $bookingId);
    if (!$row) return 'failed';
    $pub = booking_public($pdo, $row);
    $status = booking_send_email($pub, $kind);
    $pdo->prepare('UPDATE bookings SET email_status = ? WHERE booking_id = ?')->execute([$status, $bookingId]);
    booking_log_event($pdo, $bookingId, 'system', 'email-' . $status, 'Guest e-mail (' . $kind . ') to ' . $row['email']);
    if ($alsoHotel) booking_send_hotel_copy($pub, $kind);
    return $status;
}

/* Verify a payment with Razorpay itself, then turn the booking into a confirmed reservation.
   Returns ['result' => 'confirmed'|'already'|'refunded'|'not_paid'|'invalid'|'notfound'|'mismatch', 'booking' => row|null] */
function booking_confirm_payment(PDO $pdo, string $orderId, string $paymentId, string $actor): array {
    /* 1. Ask Razorpay what really happened. The browser's word alone is never enough. */
    $pay = rzp_fetch_payment($paymentId);
    if (($pay['order_id'] ?? '') !== $orderId) return ['result' => 'invalid', 'booking' => null];
    if (($pay['status'] ?? '') === 'authorized') $pay = rzp_capture_payment($paymentId, (int)$pay['amount']);
    if (($pay['status'] ?? '') !== 'captured') return ['result' => 'not_paid', 'booking' => null, 'status' => $pay['status'] ?? ''];
    $paidPaise = (int)$pay['amount'];

    /* 2. Save, under a row lock, so two requests for the same payment cannot both confirm it. */
    $soldOut = false;
    $pdo->beginTransaction();
    try {
        $s = $pdo->prepare('SELECT * FROM bookings WHERE razorpay_order_id = ? FOR UPDATE');
        $s->execute([$orderId]);
        $row = $s->fetch();
        if (!$row) { $pdo->rollBack(); return ['result' => 'notfound', 'booking' => null]; }
        if ($row['razorpay_payment_id']) { $pdo->rollBack(); return ['result' => 'already', 'booking' => $row]; }
        if ($paidPaise !== rzp_paise((float)$row['total_amount'])) {
            $pdo->rollBack();
            booking_log_event($pdo, $row['booking_id'], $actor, 'amount-mismatch', 'Paid ' . $paidPaise . ' paise, expected ' . rzp_paise((float)$row['total_amount']) . '. Payment ' . $paymentId . ' needs a manual check in Razorpay.');
            api_log('payment', 'Amount mismatch for ' . $row['booking_id'] . ' payment ' . $paymentId);
            return ['result' => 'mismatch', 'booking' => $row];
        }

        /* Normal case: the hold is still valid. If the guest paid late (hold expired, or cancelled meanwhile), check the room is still free. */
        $holdValid = $row['booking_status'] === 'pending' && $row['hold_expires_at'] && $row['hold_expires_at'] >= date('Y-m-d H:i:s');
        if (!$holdValid) {
            $room = booking_find_room($pdo, $row['room_id'], true);
            $abandoned = $row['booking_status'] === 'pending' || in_array($row['cancel_reason'] ?? '', BOOKING_ABANDONED, true);
            if (!$room || !$abandoned) $soldOut = true;
            else {
                $stay = ['checkIn' => $row['check_in'], 'checkOut' => $row['check_out'], 'adults' => (int)$row['adults'], 'children' => (int)$row['children'], 'nights' => (int)$row['number_of_nights']];
                $soldOut = !booking_room_status($pdo, $room, $stay, $row['booking_id'], true)['bookable'];
            }
        }
        $now = date('Y-m-d H:i:s');
        if ($soldOut) {
            $pdo->prepare("UPDATE bookings SET booking_status = 'cancelled', cancel_reason = 'sold_out', cancelled_at = ?, hold_expires_at = NULL, payment_status = 'paid', payment_method = 'razorpay',
                    razorpay_payment_id = ?, paid_amount = ?, paid_at = ?, updated_at = ? WHERE id = ?")->execute([$now, $paymentId, $paidPaise / 100, $now, $now, $row['id']]);
        } else {
            $pdo->prepare("UPDATE bookings SET booking_status = 'confirmed', cancel_reason = NULL, cancelled_at = NULL, hold_expires_at = NULL, payment_status = 'paid', payment_method = 'razorpay',
                    razorpay_payment_id = ?, paid_amount = ?, paid_at = ?, updated_at = ? WHERE id = ?")->execute([$paymentId, $paidPaise / 100, $now, $now, $row['id']]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    $id = $row['booking_id'];
    booking_log_event($pdo, $id, $actor, 'payment-received', 'Razorpay payment ' . $paymentId . ', ' . number_format($paidPaise / 100, 2) . ' INR');
    if ($soldOut) {
        /* Paid after the room was taken: give the money back automatically and tell the guest. */
        booking_log_event($pdo, $id, 'system', 'sold-out', 'Room no longer available after payment. Refunding automatically.');
        [$ok, $msg] = booking_refund($pdo, booking_fetch($pdo, $id), null, 'system');
        booking_notify($pdo, $id, 'soldout');
        return ['result' => 'refunded', 'booking' => booking_fetch($pdo, $id), 'refundOk' => $ok];
    }
    booking_log_event($pdo, $id, $actor, 'confirmed', 'Reservation confirmed after payment');
    booking_notify($pdo, $id, 'created', true);
    return ['result' => 'confirmed', 'booking' => booking_fetch($pdo, $id)];
}

/* Refund (full when $amount is null) through Razorpay. Returns [success, message]. Failures are recorded so the admin can finish them in the Razorpay dashboard. */
function booking_refund(PDO $pdo, array $row, ?float $amount, string $actor): array {
    $id = $row['booking_id'];
    if ($row['payment_method'] !== 'razorpay' || !$row['razorpay_payment_id']) return [false, 'This booking has no online payment to refund.'];
    $left = round((float)$row['paid_amount'] - (float)$row['refunded_amount'], 2);
    if ($left <= 0) return [false, 'This payment has already been fully refunded.'];
    $amount = $amount === null ? $left : round($amount, 2);
    if ($amount <= 0 || $amount > $left) return [false, 'The refund amount must be between 1 paisa and ' . number_format($left, 2) . '.'];
    try {
        $r = rzp_refund($row['razorpay_payment_id'], $amount, $id);
    } catch (Throwable $e) {
        api_log('refund', $id . ' | ' . $e->getMessage());
        $pdo->prepare("UPDATE bookings SET payment_status = 'refund_failed', updated_at = ? WHERE booking_id = ?")->execute([date('Y-m-d H:i:s'), $id]);
        booking_log_event($pdo, $id, $actor, 'refund-failed', $e->getMessage());
        return [false, 'Razorpay could not process the refund (' . $e->getMessage() . '). Please refund it from the Razorpay dashboard.'];
    }
    $total = round((float)$row['refunded_amount'] + $amount, 2);
    $full = $total >= round((float)$row['paid_amount'], 2) - 0.009;
    $now = date('Y-m-d H:i:s');
    $pdo->prepare('UPDATE bookings SET refunded_amount = ?, refund_id = ?, refunded_at = ?, payment_status = ?, updated_at = ? WHERE booking_id = ?')
        ->execute([$total, (string)($r['id'] ?? ''), $now, $full ? 'refunded' : 'partial_refund', $now, $id]);
    booking_log_event($pdo, $id, $actor, 'refunded', number_format($amount, 2) . ' INR refund started (' . ($r['id'] ?? '?') . '). Banks take 5-7 working days.');
    return [true, number_format($amount, 2) . ' INR refund started. It reaches the guest in 5-7 working days.'];
}
