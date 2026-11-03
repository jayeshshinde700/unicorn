<?php
/* POST api/payments/webhook.php - called BY RAZORPAY (not by the browser). It is the safety net: if a guest pays and then closes the tab
   before verify.php runs, this still confirms the booking. Set it up in Razorpay Dashboard -> Webhooks:
     URL:     https://YOUR-DOMAIN/api/payments/webhook.php
     Events:  payment.captured, order.paid, payment.failed, refund.processed
     Secret:  the same value as UCH_RAZORPAY_WEBHOOK_SECRET in api/storage/settings.php
   Security: the request is accepted only when its X-Razorpay-Signature matches (HMAC of the raw body with the webhook secret). */
require __DIR__ . '/../lib/response.php';
api_require_method('POST');

api_run(function () {
    $raw = (string)file_get_contents('php://input');
    if (!rzp_verify_webhook_signature($raw, (string)($_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? ''))) api_fail('Invalid signature.', 400);
    $e = json_decode($raw, true);
    if (!is_array($e)) api_fail('Unreadable body.', 400);
    $pdo = db();
    $event = (string)($e['event'] ?? '');
    $pay = $e['payload']['payment']['entity'] ?? [];
    $orderId = (string)($pay['order_id'] ?? ($e['payload']['order']['entity']['id'] ?? ''));
    $paymentId = (string)($pay['id'] ?? '');

    if (in_array($event, ['payment.captured', 'order.paid', 'payment.authorized'], true) && $orderId !== '' && $paymentId !== '') {
        $res = booking_confirm_payment($pdo, $orderId, $paymentId, 'razorpay');
        api_ok('Processed: ' . $res['result']);
    }
    if ($event === 'payment.failed' && $orderId !== '') {
        $s = $pdo->prepare('SELECT booking_id FROM bookings WHERE razorpay_order_id = ?');
        $s->execute([$orderId]);
        if ($b = $s->fetchColumn()) booking_log_event($pdo, (string)$b, 'razorpay', 'payment-failed', (string)($pay['error_description'] ?? 'Payment attempt failed'));
    }
    if ($event === 'refund.processed') {
        $rp = $e['payload']['refund']['entity'] ?? [];
        $s = $pdo->prepare('SELECT booking_id FROM bookings WHERE razorpay_payment_id = ?');
        $s->execute([(string)($rp['payment_id'] ?? '')]);
        if ($b = $s->fetchColumn()) booking_log_event($pdo, (string)$b, 'razorpay', 'refund-done', 'Refund ' . ($rp['id'] ?? '') . ' processed by the bank');
    }
    api_ok('Ignored: ' . $event);
}, 'webhook');
