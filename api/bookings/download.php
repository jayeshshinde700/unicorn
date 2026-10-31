<?php
/* GET api/bookings/download.php?id=UCH-XXXX&token=...  -> print-friendly booking confirmation (use the browser's Print / Save as PDF).
   No PDF library (Dompdf etc.) is installed in this project, so this is an HTML page made for printing rather than a fake PDF. */
require __DIR__ . '/../lib/response.php';
api_require_method('GET');

function receipt_h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

api_run(function () {
    $in = api_input();
    $pdo = db();
    $cfg = booking_config();
    api_rate_limit('action');
    $row = booking_authorize($pdo, ['bookingId' => $in['id'] ?? '', 'token' => $in['token'] ?? '']);
    if (!$row) api_fail('This link has expired. Please find your reservation again to print the confirmation.', 403);
    $b = booking_public($pdo, $row);
    $money = fn($n) => $cfg['currency_symbol'] . number_format($n, 0, '.', ',');
    $date = fn($d) => date('D, d M Y', strtotime($d));
    $guests = $b['stay']['adults'] . ' adult' . ($b['stay']['adults'] > 1 ? 's' : '') . ($b['stay']['children'] ? ', ' . $b['stay']['children'] . ' child' . ($b['stay']['children'] > 1 ? 'ren' : '') : '');
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    ?><!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Booking <?= receipt_h($b['bookingId']) ?> | <?= receipt_h($cfg['hotel']['name']) ?></title>
<style>
body{font-family:Inter,Arial,sans-serif;color:#1c2a25;margin:0;background:#f4f1ea}
.sheet{max-width:760px;margin:24px auto;background:#fff;padding:40px;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.08)}
h1{font-family:Georgia,serif;color:#1F3A33;margin:0 0 4px;font-size:30px}
.muted{color:#6b7570;font-size:14px}.id{font-size:26px;letter-spacing:.08em;font-weight:700;color:#7d6128;margin:18px 0}
table{width:100%;border-collapse:collapse;margin:12px 0 22px}td{padding:10px 0;border-bottom:1px solid #eee;vertical-align:top}td:first-child{color:#6b7570;width:38%}
.tot td{font-size:18px;font-weight:700;border-bottom:0;border-top:2px solid #B9995F}
.tag{display:inline-block;padding:3px 12px;border-radius:20px;background:#e6f4ec;color:#1d6b43;font-weight:600;font-size:13px;text-transform:capitalize}.tag.cancelled{background:#fbe9e6;color:#a63a2b}
.bar{max-width:760px;margin:18px auto 0;text-align:right}.bar button{background:#B9995F;border:0;padding:12px 24px;border-radius:4px;font-weight:700;cursor:pointer}
@media print{body{background:#fff}.sheet{box-shadow:none;margin:0;padding:0}.bar{display:none}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="sheet">
  <h1><?= receipt_h($cfg['hotel']['name']) ?></h1>
  <div class="muted"><?= receipt_h($cfg['hotel']['address']) ?> &middot; <?= receipt_h($cfg['contact']['phone']) ?> &middot; <?= receipt_h($cfg['contact']['email']) ?></div>
  <div class="id"><?= receipt_h($b['bookingId']) ?> <span class="tag <?= receipt_h($b['status']) ?>"><?= receipt_h($b['status']) ?></span></div>
  <table>
    <tr><td>Guest</td><td><?= receipt_h($b['guest']['firstName'] . ' ' . $b['guest']['lastName']) ?></td></tr>
    <tr><td>Email</td><td><?= receipt_h($b['guest']['email']) ?></td></tr>
    <tr><td>Phone</td><td><?= receipt_h($b['guest']['phoneCountry'] . ' ' . $b['guest']['phone']) ?></td></tr>
    <tr><td>Room</td><td><?= receipt_h($b['room']['name']) ?></td></tr>
    <tr><td>Check-in</td><td><?= receipt_h($date($b['stay']['checkIn'])) ?> (from <?= receipt_h($cfg['check_in_time']) ?>)</td></tr>
    <tr><td>Check-out</td><td><?= receipt_h($date($b['stay']['checkOut'])) ?> (by <?= receipt_h($cfg['check_out_time']) ?>)</td></tr>
    <tr><td>Nights</td><td><?= (int)$b['stay']['nights'] ?></td></tr>
    <tr><td>Guests</td><td><?= receipt_h($guests) ?></td></tr>
    <tr><td>Special requests</td><td><?= $b['guest']['specialRequests'] !== '' ? nl2br(receipt_h($b['guest']['specialRequests'])) : 'None' ?></td></tr>
  </table>
  <table>
    <tr><td><?= (int)$b['stay']['nights'] ?> night(s) &times; <?= receipt_h($money($b['pricing']['pricePerNight'])) ?></td><td><?= receipt_h($money($b['pricing']['subtotal'])) ?></td></tr>
    <?php if ($b['pricing']['taxAmount'] > 0): ?><tr><td><?= receipt_h($cfg['tax_label']) ?> (<?= receipt_h(rtrim(rtrim(number_format($b['pricing']['taxPercent'], 2), '0'), '.')) ?>%)</td><td><?= receipt_h($money($b['pricing']['taxAmount'])) ?></td></tr><?php endif; ?>
    <tr class="tot"><td>Total</td><td><?= receipt_h($money($b['pricing']['total'])) ?></td></tr>
  </table>
  <p class="muted"><?= receipt_h($cfg['payment_note']) ?> <?= receipt_h($cfg['cancellation']['text']) ?></p>
  <p class="muted">Booked on <?= receipt_h(date('d M Y, h:i A', strtotime($b['createdAt']))) ?></p>
</div></body></html>
<?php
    exit;
}, 'download');
