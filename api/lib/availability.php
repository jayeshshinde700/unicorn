<?php
/* Booking API - rooms, inventory, availability and pricing.
   Room data comes from the existing MySQL `rooms` table (the same one the admin dashboard edits). */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

/* One published room by id, decoded from the rooms.data JSON. Pass $lock = true inside a transaction to lock the row. */
function booking_find_room(PDO $pdo, string $roomId, bool $lock = false): ?array {
    $s = $pdo->prepare('SELECT data, status FROM rooms WHERE id = ?' . ($lock ? ' FOR UPDATE' : ''));
    $s->execute([$roomId]);
    $row = $s->fetch();
    if (!$row) return null;
    $r = json_decode($row['data'], true);
    if (!is_array($r)) return null;
    $r['status'] = $row['status'];
    return $r;
}

/* Rooms occupying inventory for [checkIn, checkOut): confirmed bookings + pending holds that have not expired.
   Overlap rule:  existing_checkin < requested_checkout AND existing_checkout > requested_checkin */
function booking_count_booked(PDO $pdo, string $roomId, string $checkIn, string $checkOut, ?string $excludeBookingId = null, bool $lock = false): int {
    $sql = "SELECT COUNT(*) FROM bookings
            WHERE room_id = :room AND check_in < :out AND check_out > :in
              AND (booking_status = 'confirmed' OR (booking_status = 'pending' AND hold_expires_at IS NOT NULL AND hold_expires_at > :now))";
    $p = [':room' => $roomId, ':out' => $checkOut, ':in' => $checkIn, ':now' => date('Y-m-d H:i:s')];
    if ($excludeBookingId) { $sql .= ' AND booking_id <> :ex'; $p[':ex'] = $excludeBookingId; }
    $s = $pdo->prepare($sql . ($lock ? ' FOR UPDATE' : ''));
    $s->execute($p);
    return (int)$s->fetchColumn();
}

/* Price for a stay, always calculated on the server. Money is kept in whole paise to avoid float drift. */
function booking_price(float $nightly, int $nights, float $discount = 0.0): array {
    $cfg = booking_config();
    $subtotal = round($nightly * $nights, 2);
    $discount = max(0.0, min($subtotal, round($discount, 2)));          /* a coupon can never take more than the room cost */
    $taxPct = (float)$cfg['tax_percent'];
    $tax = $taxPct > 0 ? round(($subtotal - $discount) * $taxPct / 100, 2) : 0.0;   /* tax is charged on the discounted amount */
    return ['pricePerNight' => round($nightly, 2), 'nights' => $nights, 'subtotal' => $subtotal, 'discount' => $discount, 'taxPercent' => $taxPct, 'taxAmount' => $tax, 'total' => round($subtotal - $discount + $tax, 2)];
}

/* Availability + quote for one room and one stay. Used by rooms.php (display) and create/modify (final check). */
function booking_room_status(PDO $pdo, array $room, array $stay, ?string $excludeBookingId = null, bool $lock = false): array {
    $inventory = max(0, (int)($room['inventory'] ?? 0));
    $booked = booking_count_booked($pdo, $room['id'], $stay['checkIn'], $stay['checkOut'], $excludeBookingId, $lock);
    $available = max(0, $inventory - $booked);
    $guests = $stay['adults'] + $stay['children'];
    $cap = max(1, (int)($room['guests'] ?? 2));
    $reason = '';
    if (($room['status'] ?? '') !== 'published') $reason = 'unavailable';
    elseif ($guests > $cap) $reason = 'capacity';
    elseif ($available < 1) $reason = 'soldout';
    return [
        'bookable' => $reason === '', 'reason' => $reason,
        'inventory' => $inventory, 'booked' => $booked, 'available' => $available,
        'quote' => booking_price((float)($room['price'] ?? 0), $stay['nights']),
    ];
}
