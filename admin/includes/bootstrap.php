<?php
/* Unicorn Hospitality - admin core: security helpers, room rules (storage is in db.php).
   Used by admin/*.php and api/rooms.php. Nothing in here prints anything. */

/* ---------- settings you may change ---------- */
const ADMIN_IDLE_TIMEOUT   = 1800;       /* seconds without activity before you are signed out (30 min) */
const ADMIN_MAX_FAILS      = 5;          /* wrong passwords allowed ... */
const ADMIN_LOCK_SECONDS   = 900;        /* ... before sign-in is paused for this long (15 min) */
const ADMIN_MIN_PASSWORD   = 10;         /* shortest password accepted */
const ADMIN_UPLOAD_MAX     = 6291456;    /* 6 MB per picture */
const ADMIN_REMOTE_SETUP   = false;      /* false = the very first account can only be created from this computer */
const ADMIN_TZ             = 'Asia/Kolkata';

date_default_timezone_set(ADMIN_TZ);
mb_internal_encoding('UTF-8');

define('ROOT_DIR', dirname(__DIR__, 2));
define('DATA_DIR', dirname(__DIR__) . '/data');
define('UPLOAD_REL', 'assets/images/unicon/rooms/uploads');
define('UPLOAD_DIR', ROOT_DIR . '/' . UPLOAD_REL);

const ROOM_ICONS = ['wifi','snow','tv','cup','lock','bed','bath','desk','sofa','drop','sun','car','pool','shield','plane','gym'];
const ROOM_TAGS  = ['family','signature','accessible','romantic'];
const SEASON_KEYS = ['festive','winter','summer','monsoon'];

/* ======================================================================
   Request / response helpers
   ====================================================================== */
function is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}
function is_local_request(): bool {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return in_array($ip, ['127.0.0.1', '::1'], true);
}
function client_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45); }

function security_headers(bool $page = true): void {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    if ($page) {
        header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
    }
}

function json_out($payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function admin_base_path(): string {
    $dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    return rtrim($dir, '/') . '/';
}
function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

/* ======================================================================
   Sessions + CSRF
   ====================================================================== */
function start_admin_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('unicorn_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => admin_base_path(), 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
function csrf_token(): string { start_admin_session(); return $_SESSION['csrf']; }
function csrf_ok(?string $given): bool { return is_string($given) && $given !== '' && hash_equals(csrf_token(), $given); }

function current_user(): ?array {
    start_admin_session();
    if (empty($_SESSION['uid'])) return null;
    if (time() - (int)($_SESSION['last'] ?? 0) > ADMIN_IDLE_TIMEOUT) { sign_out(); return null; }
    $_SESSION['last'] = time();
    foreach (users_all() as $u) if ($u['username'] === $_SESSION['uid']) return $u;
    sign_out();
    return null;
}
function sign_out(): void {
    start_admin_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    }
    session_destroy();
}
function sign_in(array $user): void {
    start_admin_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = $user['username'];
    $_SESSION['last'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

/* ======================================================================
   Storage: MySQL / MariaDB (admin/includes/config.php + db.php)
   users, sign-in throttle, activity log and rooms all live in the database.
   ====================================================================== */
require_once __DIR__ . '/db.php';

/* if the database cannot be reached, answer cleanly instead of showing a PHP error */
set_exception_handler(function ($e) {
    error_log('[unicorn-admin] ' . $e->getMessage());
    $api = preg_match('#/(api\.php|rooms\.php)$#', $_SERVER['SCRIPT_NAME'] ?? '');
    http_response_code(503);
    if ($api) { header('Content-Type: application/json; charset=utf-8'); echo json_encode(['ok' => false, 'error' => 'The database is not available right now.']); exit; }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>Database not available</title><body style="font-family:sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;line-height:1.6"><h1>Database not available</h1><p>Please check that MySQL is running in XAMPP and that the details in <code>admin/includes/config.php</code> are right.</p>' . (is_local_request() ? '<p style="color:#8f2a20"><small>' . htmlspecialchars($e->getMessage()) . '</small></p>' : '') . '</body>';
    exit;
});

/* ======================================================================
   Rooms
   ====================================================================== */
function default_room(): array {
    return [
        'id' => '', 'name' => '', 'category' => 'room', 'tags' => [], 'badge' => ['text' => '', 'style' => 'light'], 'status' => 'draft', 'featured' => false,
        'short' => '', 'tagline' => '', 'description' => '', 'notes' => 'Check-in from 2:00 PM, check-out by 11:00 AM. Extra bed on request, subject to availability. Breakfast, Wi-Fi, parking and pool access are included.',
        'size' => 30, 'guests' => 2, 'bed' => 'King bed', 'view' => '', 'inventory' => 1, 'extraBed' => ['available' => false, 'price' => 0],
        'price' => 5000, 'seasonal' => ['festive' => null, 'winter' => null, 'summer' => null, 'monsoon' => null],
        'image' => '', 'imageAlt' => '', 'gallery' => [],
        'amenities' => [['icon' => 'wifi', 'label' => 'Free Wi-Fi'], ['icon' => 'snow', 'label' => 'Air-conditioning'], ['icon' => 'tv', 'label' => 'Flat-screen TV'], ['icon' => 'cup', 'label' => 'Tea & coffee maker']],
        'features' => ['desk' => false, 'shower' => false, 'lounge' => false, 'dining' => false, 'apart' => false],
        'seoTitle' => '', 'seoDescription' => '', 'rank' => 0, 'createdAt' => 0, 'updatedAt' => 0, 'updatedBy' => ''
    ];
}
/* the five rooms that are on the public page today, so the admin starts with real content */
function seed_rooms(): array {
    $now = time(); $base = 'assets/images/unicon/rooms/';
    $mk = function (array $o) use ($now) { return array_replace_recursive(default_room(), $o, ['status' => 'published', 'createdAt' => $now, 'updatedAt' => $now, 'updatedBy' => 'seed']); };
    return [
        $mk(['id' => 'deluxe', 'name' => 'Deluxe Room', 'category' => 'room', 'tags' => [], 'badge' => ['text' => 'Most booked', 'style' => 'light'], 'rank' => 1,
            'short' => 'Calm neutrals, a plush king bed and tall windows with soft drapes. Our easiest way to feel at home.', 'tagline' => 'Calm, classic comfort',
            'description' => 'A quiet, softly lit room in warm neutrals. The king bed has plush bedding, quality linens and a choice of pillows, and tall windows with floor-length drapes let the morning in. Simple, restful and easy to love.',
            'size' => 32, 'guests' => 2, 'bed' => 'King bed', 'view' => 'City light', 'inventory' => 12, 'price' => 4500, 'image' => $base . 'deluxe.jpg', 'imageAlt' => 'Deluxe Room at Unicorn Hospitality',
            'amenities' => [['icon' => 'wifi', 'label' => 'Free Wi-Fi'], ['icon' => 'snow', 'label' => 'Air-conditioning'], ['icon' => 'tv', 'label' => 'Flat-screen TV'], ['icon' => 'cup', 'label' => 'Tea & coffee maker'], ['icon' => 'lock', 'label' => 'In-room safe'], ['icon' => 'bed', 'label' => 'Choice of pillows'], ['icon' => 'bath', 'label' => 'En-suite bathroom'], ['icon' => 'car', 'label' => 'Free parking']]]),
        $mk(['id' => 'executive', 'name' => 'Executive Room', 'category' => 'room', 'tags' => [], 'badge' => ['text' => 'City view', 'style' => 'light'], 'rank' => 2,
            'short' => 'More space, more light and a window onto the city. Made for business trips that deserve a better night.', 'tagline' => 'Space to work, room to unwind',
            'description' => 'More space and more light than our Deluxe, with a tall window onto the city. A work corner keeps the laptop close, the king bed keeps the night long. Made for business trips that deserve a better sleep.',
            'size' => 38, 'guests' => 2, 'bed' => 'King bed', 'view' => 'City view', 'inventory' => 8, 'price' => 5800, 'image' => $base . 'executive.jpg', 'imageAlt' => 'Executive Room at Unicorn Hospitality',
            'amenities' => [['icon' => 'wifi', 'label' => 'Free Wi-Fi'], ['icon' => 'desk', 'label' => 'Work corner'], ['icon' => 'snow', 'label' => 'Air-conditioning'], ['icon' => 'tv', 'label' => 'Flat-screen TV'], ['icon' => 'cup', 'label' => 'Tea & coffee maker'], ['icon' => 'lock', 'label' => 'In-room safe'], ['icon' => 'sun', 'label' => 'City-view window'], ['icon' => 'car', 'label' => 'Free parking']],
            'features' => ['desk' => true]]),
        $mk(['id' => 'family', 'name' => 'Family Suite', 'category' => 'suite', 'tags' => ['family'], 'badge' => ['text' => 'Best for families', 'style' => 'light'], 'rank' => 3,
            'short' => 'Room for everyone: twin beds, a separate sleeping area and space to spread out after a long day out.', 'tagline' => 'Everyone under one roof',
            'description' => 'Twin beds, a separate sleeping area and plenty of space to spread out after a long day. Wooden wardrobes, a bright bathroom and a calm, airy feel make it easy for the whole family to settle in.',
            'size' => 52, 'guests' => 4, 'bed' => '2 twin beds', 'view' => 'Garden side', 'inventory' => 4, 'price' => 8200, 'extraBed' => ['available' => true, 'price' => 1200], 'image' => $base . 'family.jpg', 'imageAlt' => 'Family Suite at Unicorn Hospitality',
            'amenities' => [['icon' => 'bed', 'label' => 'Twin beds'], ['icon' => 'sofa', 'label' => 'Extra sleeping space'], ['icon' => 'wifi', 'label' => 'Free Wi-Fi'], ['icon' => 'snow', 'label' => 'Air-conditioning'], ['icon' => 'tv', 'label' => 'Flat-screen TV'], ['icon' => 'cup', 'label' => 'Tea & coffee maker'], ['icon' => 'lock', 'label' => 'In-room safe'], ['icon' => 'bath', 'label' => 'Bathroom with shower']],
            'features' => ['lounge' => true, 'apart' => true]]),
        $mk(['id' => 'premium', 'name' => 'Premium Suite', 'category' => 'suite', 'tags' => [], 'badge' => ['text' => 'Warm & glowing', 'style' => 'light'], 'rank' => 4,
            'short' => 'Layered lighting, a statement headboard wall and a table for a quiet dinner in. Rich, warm and private.', 'tagline' => 'Rich, warm and private',
            'description' => 'Layered lighting, a statement headboard wall and a small table for a quiet dinner in. The Premium Suite is warm, glowing and generously sized, for guests who like their evenings unhurried.',
            'size' => 60, 'guests' => 3, 'bed' => 'King bed', 'view' => 'Courtyard', 'inventory' => 3, 'price' => 9800, 'image' => $base . 'premium.jpg', 'imageAlt' => 'Premium Suite at Unicorn Hospitality',
            'amenities' => [['icon' => 'tv', 'label' => 'Smart TV'], ['icon' => 'sofa', 'label' => 'Dining nook'], ['icon' => 'drop', 'label' => 'Rain shower'], ['icon' => 'wifi', 'label' => 'Free Wi-Fi'], ['icon' => 'desk', 'label' => 'Work desk'], ['icon' => 'snow', 'label' => 'Air-conditioning'], ['icon' => 'lock', 'label' => 'In-room safe'], ['icon' => 'cup', 'label' => 'Tea & coffee maker']],
            'features' => ['desk' => true, 'shower' => true, 'lounge' => true, 'dining' => true]]),
        $mk(['id' => 'unicon', 'name' => 'The Unicon Suite', 'category' => 'suite', 'tags' => ['family', 'signature'], 'badge' => ['text' => 'Signature', 'style' => 'gold'], 'rank' => 5, 'featured' => true,
            'short' => 'Our most open, light-filled suite. Wide glass doors, natural timber and airy linen, made for slow mornings.', 'tagline' => 'Our signature suite',
            'description' => 'Our most open, light-filled suite. Wide glass doors, natural timber and airy linen make mornings feel slow in the best way. A private lounge, a king bed and the most space we offer, all in one calm room.',
            'size' => 85, 'guests' => 4, 'bed' => 'King bed + lounge', 'view' => 'Open view', 'inventory' => 1, 'price' => 14500, 'image' => $base . 'unicon.webp', 'imageAlt' => 'The Unicon Suite at Unicorn Hospitality',
            'amenities' => [['icon' => 'sun', 'label' => 'Open view'], ['icon' => 'sofa', 'label' => 'Private lounge'], ['icon' => 'drop', 'label' => 'Rain shower'], ['icon' => 'wifi', 'label' => 'Free Wi-Fi'], ['icon' => 'desk', 'label' => 'Work desk'], ['icon' => 'tv', 'label' => 'Smart TV'], ['icon' => 'snow', 'label' => 'Air-conditioning'], ['icon' => 'lock', 'label' => 'In-room safe']],
            'features' => ['desk' => true, 'shower' => true, 'lounge' => true, 'dining' => true, 'apart' => true]]),
    ];
}
function slugify(string $s): string {
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim(substr($s, 0, 40), '-');
}
function unique_id(string $base, array $rooms, ?string $ignore = null): string {
    $base = $base !== '' ? $base : 'room';
    $ids = array_column($rooms, 'id'); $id = $base; $i = 2;
    while (in_array($id, $ids, true) && $id !== $ignore) { $id = substr($base, 0, 36) . '-' . $i++; }
    return $id;
}
function valid_image_path($p): bool {
    return is_string($p) && preg_match('#^assets/images/[A-Za-z0-9_./-]+\.(jpe?g|png|webp|avif)$#i', $p) && strpos($p, '..') === false;
}

/* Validate + clean one room. Returns [room, errors]. */
function room_clean(array $in, ?array $old, array $allRooms): array {
    $e = []; $d = default_room();
    $str = function ($k, $max, $req = false, $label = null) use ($in, &$e) {
        $v = trim((string)($in[$k] ?? '')); $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v);
        if ($req && $v === '') $e[$k] = ($label ?? 'This') . ' is required.';
        if (mb_strlen($v) > $max) $e[$k] = 'Keep this under ' . $max . ' characters.';
        return $v;
    };
    $int = function ($k, $min, $max, $req = true) use ($in, &$e) {
        $raw = $in[$k] ?? null;
        if ($raw === null || $raw === '') { if ($req) $e[$k] = 'Please enter a number.'; return null; }
        if (!is_numeric($raw) || (float)$raw != (int)$raw) { $e[$k] = 'Use a whole number.'; return null; }
        $v = (int)$raw;
        if ($v < $min || $v > $max) $e[$k] = 'Enter a value between ' . $min . ' and ' . $max . '.';
        return $v;
    };
    $r = $d;
    $r['name'] = $str('name', 60, true, 'The room name');
    if ($r['name'] !== '' && mb_strlen($r['name']) < 2) $e['name'] = 'The name is too short.';
    $cat = $in['category'] ?? 'room'; $r['category'] = in_array($cat, ['room', 'suite'], true) ? $cat : 'room';
    $r['tags'] = array_values(array_intersect(ROOM_TAGS, is_array($in['tags'] ?? null) ? $in['tags'] : []));
    $b = is_array($in['badge'] ?? null) ? $in['badge'] : [];
    $r['badge'] = ['text' => mb_substr(trim((string)($b['text'] ?? '')), 0, 24), 'style' => (($b['style'] ?? '') === 'gold') ? 'gold' : 'light'];
    $r['status'] = (($in['status'] ?? '') === 'published') ? 'published' : 'draft';
    $r['featured'] = !empty($in['featured']);
    $r['short'] = $str('short', 180);
    $r['tagline'] = $str('tagline', 80);
    $r['description'] = $str('description', 1200);
    $r['notes'] = $str('notes', 500);
    $r['size'] = $int('size', 8, 500);
    $r['guests'] = $int('guests', 1, 12);
    $r['bed'] = $str('bed', 40, true, 'The bed type');
    $r['view'] = $str('view', 40);
    $r['inventory'] = $int('inventory', 0, 500, false) ?? 0;
    $eb = is_array($in['extraBed'] ?? null) ? $in['extraBed'] : [];
    $ebp = (int)($eb['price'] ?? 0);
    if ($ebp < 0 || $ebp > 50000) $e['extraBedPrice'] = 'Enter a value between 0 and 50,000.';
    $r['extraBed'] = ['available' => !empty($eb['available']), 'price' => max(0, min(50000, $ebp))];
    $r['price'] = $int('price', 100, 500000);
    $sea = is_array($in['seasonal'] ?? null) ? $in['seasonal'] : [];
    foreach (SEASON_KEYS as $k) {
        $v = $sea[$k] ?? null;
        if ($v === null || $v === '') { $r['seasonal'][$k] = null; continue; }
        if (!is_numeric($v) || (int)$v < 100 || (int)$v > 500000) { $e['seasonal_' . $k] = 'Enter a price between 100 and 500,000, or leave empty.'; $r['seasonal'][$k] = null; }
        else $r['seasonal'][$k] = (int)$v;
    }
    $img = trim((string)($in['image'] ?? ''));
    if ($img !== '' && !valid_image_path($img)) { $e['image'] = 'That picture path is not allowed.'; $img = ''; }
    $r['image'] = $img;
    $r['imageAlt'] = $str('imageAlt', 120);
    $gal = [];
    foreach ((is_array($in['gallery'] ?? null) ? $in['gallery'] : []) as $g) if (valid_image_path($g) && !in_array($g, $gal, true)) $gal[] = $g;
    $r['gallery'] = array_slice($gal, 0, 8);
    $am = [];
    foreach ((is_array($in['amenities'] ?? null) ? $in['amenities'] : []) as $a) {
        if (!is_array($a)) continue;
        $icon = in_array($a['icon'] ?? '', ROOM_ICONS, true) ? $a['icon'] : 'shield';
        $label = mb_substr(trim((string)($a['label'] ?? '')), 0, 40);
        if ($label !== '') $am[] = ['icon' => $icon, 'label' => $label];
    }
    if (count($am) > 14) $e['amenities'] = 'Keep it to 14 amenities or fewer.';
    $r['amenities'] = array_slice($am, 0, 14);
    $f = is_array($in['features'] ?? null) ? $in['features'] : [];
    foreach (array_keys($d['features']) as $k) $r['features'][$k] = !empty($f[$k]);
    $r['seoTitle'] = $str('seoTitle', 70);
    $r['seoDescription'] = $str('seoDescription', 160);
    /* id */
    $wanted = slugify((string)($in['id'] ?? ''));
    if ($wanted === '') $wanted = slugify($r['name']);
    $oldId = $old['id'] ?? null;
    if ($wanted === '') { $e['id'] = 'Please give the room a name.'; }
    else {
        foreach ($allRooms as $x) if ($x['id'] === $wanted && $x['id'] !== $oldId) { $e['id'] = 'Another room already uses this web address.'; break; }
    }
    $r['id'] = $wanted;
    if ($r['status'] === 'published') {
        if ($r['image'] === '') $e['image'] = 'Add a main picture before publishing.';
        if ($r['short'] === '') $e['short'] = 'Add a short description before publishing.';
    }
    $r['rank'] = $old['rank'] ?? 0;
    $r['createdAt'] = $old['createdAt'] ?? time();
    $r['updatedAt'] = time();
    $r['updatedBy'] = $_SESSION['uid'] ?? 'system';
    return [$r, $e];
}

/* what the public site is allowed to see */
function room_public(array $r): array {
    $tags = array_merge([$r['category']], $r['tags']);
    return [
        'id' => $r['id'], 'name' => $r['name'], 'category' => $r['category'], 'tags' => implode(' ', array_unique($tags)),
        'badge' => $r['badge'], 'featured' => $r['featured'], 'rank' => $r['rank'],
        'short' => $r['short'], 'tagline' => $r['tagline'], 'description' => $r['description'], 'notes' => $r['notes'],
        'size' => $r['size'], 'guests' => $r['guests'], 'bed' => $r['bed'], 'view' => $r['view'],
        'price' => $r['price'], 'seasonal' => $r['seasonal'], 'extraBed' => $r['extraBed'],
        'image' => $r['image'], 'imageAlt' => $r['imageAlt'] ?: ($r['name'] . ' at Unicorn Hospitality'), 'gallery' => $r['gallery'],
        'amenities' => $r['amenities'], 'features' => $r['features'],
    ];
}

/* pictures that live in assets/images/unicon/rooms (+ uploads) */
function media_list(): array {
    $out = [];
    foreach ([['assets/images/unicon/rooms', false], [UPLOAD_REL, true]] as [$rel, $up]) {
        $dir = ROOT_DIR . '/' . $rel;
        if (!is_dir($dir)) continue;
        foreach (scandir($dir) as $f) {
            if (!preg_match('/\.(jpe?g|png|webp|avif)$/i', $f)) continue;
            $p = $dir . '/' . $f; if (!is_file($p)) continue;
            $out[] = ['path' => $rel . '/' . $f, 'name' => $f, 'size' => filesize($p), 'uploaded' => $up, 'time' => filemtime($p)];
        }
    }
    usort($out, fn($a, $b) => $b['time'] <=> $a['time']);
    return $out;
}
