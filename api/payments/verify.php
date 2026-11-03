<?php
/* POST api/payments/verify.php - step 2 of 2 of a booking. The browser sends what Razorpay Checkout returned after payment:
   {bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature}.
   We check the signature, then ask Razorpay itself whether the money was captured (booking_confirm_payment). Only then is the reservation confirmed. */
require __DIR__ . '/../lib/response.php';
api_require_method('POST');
api_require_same_origin();

api_run(function () {
    $in = api_input();
    $pdo = db();
    api_rate_limit('action');

    $id = booking_clean_id($in['bookingId'] ?? '');
    $order = v_text($in['razorpay_order_id'] ?? '', 40);
    $payment = v_text($in['razorpay_payment_id'] ?? '', 40);
    $sig = v_text($in['razorpay_signature'] ?? '', 128);
    $row = $id !== '' ? booking_fetch($pdo, $id) : null;
    if (!$row || $row['razorpay_order_id'] !== $order) api_fail('We could not match this payment to a booking. If money was deducted, it will be confirmed automatically or refunded. Please contact reservations with your Booking ID.', 404);

    if (!rzp_verify_payment_signature($order, $payment, $sig)) {
        booking_log_event($pdo, $id, 'guest', 'bad-signature', 'Payment ' . $payment . ' failed the signature check');
        api_fail('The payment could not be verified. If money was deducted, please contact reservations with your Booking ID.', 400);
    }

    $res = booking_confirm_payment($pdo, $order, $payment, 'guest');
    switch ($res['result']) {
        case 'confirmed':
        case 'already':
            api_ok('Payment received. Your reservation is confirmed.', booking_public($pdo, booking_fetch($pdo, $id), true));
        case 'refunded':
            api_fail('Sorry, the last room for these dates was taken just before your payment arrived. Your payment is being refunded in full. Please choose other dates or contact reservations.', 409);
        case 'not_paid':
            api_fail('Your payment has not been completed yet (status: ' . ($res['status'] ?? 'unknown') . '). If money was deducted, the booking will confirm automatically within a few minutes.', 402);
        default:
            api_fail('We received your payment but need to check it manually. Please contact reservations with Booking ID ' . $id . '.', 500);
    }
}, 'verify');
