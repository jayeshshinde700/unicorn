<?php
/* Unicorn Hospitality - PUBLIC rooms feed (read only, no sign-in).
   Returns only published rooms, sorted as set in the admin, and only the fields the website needs.
   Use:  fetch('api/rooms.php').then(r => r.json()).then(d => d.rooms) */
require_once dirname(__DIR__) . '/admin/includes/db.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=30');
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'HEAD') { http_response_code(405); echo '{"ok":false}'; exit; }

$rooms = array_values(array_filter(rooms_load(), fn($r) => ($r['status'] ?? '') === 'published'));
echo json_encode([
    'ok' => true,
    'updated' => rooms_updated(),
    'count' => count($rooms),
    'rooms' => array_map('room_public', $rooms),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
