<?php
/* Razorpay REST helper (no Composer package needed - plain cURL).
   Docs: https://razorpay.com/docs/api/orders/   https://razorpay.com/docs/api/payments/   https://razorpay.com/docs/api/refunds/
   Money: Razorpay works in PAISE (1 rupee = 100 paise). Always use rzp_paise() to convert. */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

function rzp_paise(float $rupees): int { return (int)round($rupees * 100); }

function rzp_configured(): bool {
    $c = booking_config()['razorpay'];
    return $c['key_id'] !== '' && $c['key_secret'] !== '';
}

/* Call the Razorpay API. Returns the decoded JSON. Throws RuntimeException with a safe message on any failure. */
function rzp_request(string $method, string $path, ?array $body = null): array {
    $c = booking_config()['razorpay'];
    if (!rzp_configured()) throw new RuntimeException('Razorpay keys are not set (api/storage/settings.php)');
    if (!function_exists('curl_init')) throw new RuntimeException('The PHP cURL extension is not enabled');
    $ch = curl_init($c['api_base'] . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_USERPWD => $c['key_id'] . ':' . $c['key_secret'],
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($raw === false) throw new RuntimeException('Could not reach Razorpay: ' . $err);
    $j = json_decode((string)$raw, true);
    if (!is_array($j)) throw new RuntimeException('Razorpay sent an unreadable answer (HTTP ' . $code . ')');
    if ($code >= 400 || isset($j['error'])) throw new RuntimeException('Razorpay: ' . ($j['error']['description'] ?? ('HTTP ' . $code)));
    return $j;
}

/* An "order" is the payment request for one booking. The guest pays against its id. */
function rzp_create_order(float $amountRupees, string $bookingId): array {
    return rzp_request('POST', '/orders', [
        'amount' => rzp_paise($amountRupees), 'currency' => 'INR', 'receipt' => $bookingId,
        'notes' => ['booking_id' => $bookingId],
    ]);
}

/* The signature Razorpay Checkout returns after payment: HMAC-SHA256 of "order_id|payment_id" with your key secret. */
function rzp_verify_payment_signature(string $orderId, string $paymentId, string $signature): bool {
    $secret = booking_config()['razorpay']['key_secret'];
    if ($secret === '' || $orderId === '' || $paymentId === '' || $signature === '') return false;
    return hash_equals(hash_hmac('sha256', $orderId . '|' . $paymentId, $secret), $signature);
}

/* Webhook signature: HMAC-SHA256 of the raw request body with the webhook secret. */
function rzp_verify_webhook_signature(string $rawBody, string $signature): bool {
    $secret = booking_config()['razorpay']['webhook_secret'];
    if ($secret === '' || $signature === '') return false;
    return hash_equals(hash_hmac('sha256', $rawBody, $secret), $signature);
}

function rzp_fetch_payment(string $paymentId): array { return rzp_request('GET', '/payments/' . rawurlencode($paymentId)); }

/* Money that was only "authorized" (not yet captured) must be captured or it is returned to the guest after a few days. */
function rzp_capture_payment(string $paymentId, int $paise): array {
    return rzp_request('POST', '/payments/' . rawurlencode($paymentId) . '/capture', ['amount' => $paise, 'currency' => 'INR']);
}

function rzp_refund(string $paymentId, float $amountRupees, string $bookingId): array {
    return rzp_request('POST', '/payments/' . rawurlencode($paymentId) . '/refund', [
        'amount' => rzp_paise($amountRupees), 'speed' => 'normal', 'notes' => ['booking_id' => $bookingId],
    ]);
}
