<?php
/* ======================================================================
   Unicorn Hospitality - MySQL Database & Core Backend
   Database credentials are in config.php.
   SQL schema & seed data are in database.sql.
   ====================================================================== */

require_once __DIR__ . '/config.php';

/* ---------- Constants & Paths ---------- */
define('ROOT_DIR', dirname(__DIR__, 2));
define('UPLOAD_REL', 'assets/images/unicon/rooms/uploads');
define('UPLOAD_DIR', ROOT_DIR . '/' . UPLOAD_REL);

const ADMIN_IDLE_TIMEOUT = 1800;    /* 30 minutes */
const ADMIN_MAX_FAILS    = 5;
const ADMIN_LOCK_SECONDS = 900;
const ADMIN_MIN_PASSWORD = 8;
const ADMIN_UPLOAD_MAX   = 6291456; /* 6 MB */

const ROOM_ICONS   = ['wifi','snow','tv','cup','lock','bed','bath','desk','sofa','drop','sun','car','pool','shield','plane','gym'];
const ROOM_TAGS    = ['family','signature','accessible','romantic'];
const SEASON_KEYS  = ['festive','winter','summer','monsoon'];

date_default_timezone_set('Asia/Kolkata');
mb_internal_encoding('UTF-8');

/* ======================================================================
   1. Database Connection (PDO)
   ====================================================================== */
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // If database does not exist yet (error 1049), auto-create it
        if ((int)$e->getCode() === 1049) {
            $tmp = new PDO('mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4', DB_USER, DB_PASS, $options);
            $tmp->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', DB_NAME) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } else {
            throw $e;
        }
    }

    return $pdo;
}

/* ======================================================================
   2. Session & Auth Helpers
   ====================================================================== */
function start_admin_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('unicorn_admin');
    session_start();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
}

function csrf_token(): string {
    start_admin_session();
    return $_SESSION['csrf'] ?? '';
}

function csrf_ok(?string $token): bool {
    start_admin_session();
    return is_string($token) && $token !== '' && hash_equals($_SESSION['csrf'] ?? '', $token);
}

function current_user(): ?array {
    start_admin_session();
    if (empty($_SESSION['uid'])) return null;
    if (time() - (int)($_SESSION['last'] ?? 0) > ADMIN_IDLE_TIMEOUT) {
        sign_out();
        return null;
    }
    $_SESSION['last'] = time();
    $s = db()->prepare('SELECT username, name, password_hash, created_at FROM admin_users WHERE username = ?');
    $s->execute([$_SESSION['uid']]);
    $u = $s->fetch();
    return $u ? ['username' => $u['username'], 'name' => $u['name'], 'hash' => $u['password_hash'], 'createdAt' => (int)$u['created_at']] : null;
}

function sign_in(array $user): void {
    start_admin_session();
    session_regenerate_id(true);
    $_SESSION['uid']  = $user['username'];
    $_SESSION['last'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function sign_out(): void {
    start_admin_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'] ?? '', false, true);
    }
    session_destroy();
}

/* ======================================================================
   3. User Queries (admin_users table)
   ====================================================================== */
function users_exist(): bool {
    return (int)db()->query('SELECT COUNT(*) FROM admin_users')->fetchColumn() > 0;
}

function users_all(): array {
    $rows = db()->query('SELECT username, name, password_hash, created_at FROM admin_users ORDER BY created_at, username')->fetchAll();
    return array_map(fn($u) => ['username' => $u['username'], 'name' => $u['name'], 'hash' => $u['password_hash'], 'createdAt' => (int)$u['created_at']], $rows);
}

function user_save_all(array $users): void {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('INSERT INTO admin_users (username, name, password_hash, created_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)');
        $keep = [];
        foreach ($users as $u) {
            $st->execute([$u['username'], $u['name'], $u['hash'], (int)($u['createdAt'] ?? time())]);
            $keep[] = $u['username'];
        }
        if ($keep) {
            $inClause = implode(',', array_fill(0, count($keep), '?'));
            $pdo->prepare("DELETE FROM admin_users WHERE username NOT IN ($inClause)")->execute($keep);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/* ======================================================================
   4. Activity Log Queries (admin_activity table)
   ====================================================================== */
function log_activity(string $action, string $detail = '', ?string $user = null): void {
    try {
        $pdo = db();
        $pdo->prepare('INSERT INTO admin_activity (t, username, action, detail, ip) VALUES (?,?,?,?,?)')
            ->execute([time(), substr($user ?? ($_SESSION['uid'] ?? 'system'), 0, 40), substr($action, 0, 40), mb_substr($detail, 0, 160), $_SERVER['REMOTE_ADDR'] ?? '']);
    } catch (Throwable $e) {}
}

function activity_recent(int $limit = 80): array {
    $s = db()->prepare('SELECT t, username, action, detail, ip FROM admin_activity ORDER BY id DESC LIMIT ?');
    $s->bindValue(1, max(1, min(200, $limit)), PDO::PARAM_INT);
    $s->execute();
    return array_map(fn($a) => ['t' => (int)$a['t'], 'user' => $a['username'], 'action' => $a['action'], 'detail' => $a['detail'], 'ip' => $a['ip']], $s->fetchAll());
}

/* ======================================================================
   5. Site Settings (site_meta table)
   ====================================================================== */
function meta_get(string $k): ?string {
    $s = db()->prepare('SELECT v FROM site_meta WHERE k = ?');
    $s->execute([$k]);
    $v = $s->fetchColumn();
    return $v === false ? null : (string)$v;
}

function db_meta_set(PDO $pdo, string $k, string $v): void {
    $pdo->prepare('INSERT INTO site_meta (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)')->execute([$k, $v]);
}

function rooms_saved(): bool { return meta_get('rooms_saved') === '1'; }
function rooms_updated(): ?int { $v = meta_get('rooms_updated'); return $v === null ? null : (int)$v; }

/* ======================================================================
   6. Room Queries (rooms table)
   ====================================================================== */
function rooms_load(): array {
    $rows = db()->query('SELECT data FROM rooms ORDER BY rank_no, id')->fetchAll(PDO::FETCH_COLUMN);
    $out = [];
    foreach ($rows as $j) {
        $r = json_decode($j, true);
        if (is_array($r)) $out[] = $r;
    }
    return $out;
}

function db_put_room(PDO $pdo, array $r): void {
    $pdo->prepare('INSERT INTO rooms (id, name, category, status, featured, price, size, guests, rank_no, data, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), status = VALUES(status), featured = VALUES(featured), price = VALUES(price), size = VALUES(size),
        guests = VALUES(guests), rank_no = VALUES(rank_no), data = VALUES(data), updated_at = VALUES(updated_at)')
        ->execute([
            $r['id'],
            $r['name'],
            ($r['category'] ?? '') === 'suite' ? 'suite' : 'room',
            ($r['status'] ?? '') === 'published' ? 'published' : 'draft',
            !empty($r['featured']) ? 1 : 0,
            (int)($r['price'] ?? 0),
            (int)($r['size'] ?? 0),
            (int)($r['guests'] ?? 0),
            (int)($r['rank'] ?? 0),
            json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            (int)($r['createdAt'] ?? time()),
            (int)($r['updatedAt'] ?? time())
        ]);
}

function rooms_save(array $rooms): void {
    usort($rooms, fn($a, $b) => ($a['rank'] ?? 0) <=> ($b['rank'] ?? 0));
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $ids = array_column($rooms, 'id');
        if ($ids) {
            $inClause = implode(',', array_fill(0, count($ids), '?'));
            $pdo->prepare("DELETE FROM rooms WHERE id NOT IN ($inClause)")->execute($ids);
        } else {
            $pdo->exec('DELETE FROM rooms');
        }
        foreach ($rooms as $r) db_put_room($pdo, $r);
        db_meta_set($pdo, 'rooms_saved', '1');
        db_meta_set($pdo, 'rooms_updated', (string)time());
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/* ======================================================================
   7. Room Validation & Formatting Helpers
   ====================================================================== */
function default_room(): array {
    return [
        'id' => '', 'name' => '', 'category' => 'room', 'tags' => [], 'badge' => ['text' => '', 'style' => 'light'], 'status' => 'draft', 'featured' => false,
        'short' => '', 'tagline' => '', 'description' => '', 'notes' => 'Check-in from 2:00 PM, check-out by 11:00 AM. Breakfast, Wi-Fi, and parking included.',
        'size' => 30, 'guests' => 2, 'bed' => 'King bed', 'view' => '', 'inventory' => 1, 'extraBed' => ['available' => false, 'price' => 0],
        'price' => 5000, 'seasonal' => ['festive' => null, 'winter' => null, 'summer' => null, 'monsoon' => null],
        'image' => '', 'imageAlt' => '', 'gallery' => [],
        'amenities' => [['icon' => 'wifi', 'label' => 'Free Wi-Fi'], ['icon' => 'snow', 'label' => 'Air-conditioning'], ['icon' => 'tv', 'label' => 'Flat-screen TV'], ['icon' => 'cup', 'label' => 'Tea & coffee maker']],
        'features' => ['desk' => false, 'shower' => false, 'lounge' => false, 'dining' => false, 'apart' => false],
        'seoTitle' => '', 'seoDescription' => '', 'rank' => 0, 'createdAt' => 0, 'updatedAt' => 0, 'updatedBy' => ''
    ];
}

function slugify(string $s): string {
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim(substr($s, 0, 40), '-');
}

function unique_id(string $base, array $rooms, ?string $ignore = null): string {
    $base = $base !== '' ? $base : 'room';
    $ids = array_column($rooms, 'id');
    $id = $base;
    $i = 2;
    while (in_array($id, $ids, true) && $id !== $ignore) {
        $id = substr($base, 0, 36) . '-' . $i++;
    }
    return $id;
}

function valid_image_path($p): bool {
    return is_string($p) && preg_match('#^assets/images/[A-Za-z0-9_./-]+\.(jpe?g|png|webp|avif)$#i', $p) && strpos($p, '..') === false;
}

function room_clean(array $in, ?array $old, array $allRooms): array {
    $errors = [];
    $r = default_room();

    $r['name'] = trim((string)($in['name'] ?? ''));
    if ($r['name'] === '') $errors['name'] = 'Room name is required.';

    $cat = $in['category'] ?? 'room';
    $r['category'] = in_array($cat, ['room', 'suite'], true) ? $cat : 'room';
    $r['tags'] = array_values(array_intersect(ROOM_TAGS, is_array($in['tags'] ?? null) ? $in['tags'] : []));

    $b = is_array($in['badge'] ?? null) ? $in['badge'] : [];
    $r['badge'] = ['text' => mb_substr(trim((string)($b['text'] ?? '')), 0, 24), 'style' => (($b['style'] ?? '') === 'gold') ? 'gold' : 'light'];

    $r['status'] = (($in['status'] ?? '') === 'published') ? 'published' : 'draft';
    $r['featured'] = !empty($in['featured']);
    $r['short'] = trim((string)($in['short'] ?? ''));
    $r['tagline'] = trim((string)($in['tagline'] ?? ''));
    $r['description'] = trim((string)($in['description'] ?? ''));
    $r['notes'] = trim((string)($in['notes'] ?? ''));
    $r['size'] = max(1, (int)($in['size'] ?? 30));
    $r['guests'] = max(1, (int)($in['guests'] ?? 2));
    $r['bed'] = trim((string)($in['bed'] ?? 'King bed'));
    $r['view'] = trim((string)($in['view'] ?? ''));
    $r['inventory'] = max(0, (int)($in['inventory'] ?? 1));
    $r['price'] = max(0, (int)($in['price'] ?? 0));

    $eb = is_array($in['extraBed'] ?? null) ? $in['extraBed'] : [];
    $r['extraBed'] = ['available' => !empty($eb['available']), 'price' => max(0, (int)($eb['price'] ?? 0))];

    $sea = is_array($in['seasonal'] ?? null) ? $in['seasonal'] : [];
    foreach (SEASON_KEYS as $k) {
        $v = $sea[$k] ?? null;
        $r['seasonal'][$k] = ($v === null || $v === '') ? null : (int)$v;
    }

    $r['image'] = trim((string)($in['image'] ?? ''));
    $r['imageAlt'] = trim((string)($in['imageAlt'] ?? ''));

    $gal = [];
    foreach ((is_array($in['gallery'] ?? null) ? $in['gallery'] : []) as $g) {
        if (valid_image_path($g) && !in_array($g, $gal, true)) $gal[] = $g;
    }
    $r['gallery'] = array_slice($gal, 0, 8);

    $am = [];
    foreach ((is_array($in['amenities'] ?? null) ? $in['amenities'] : []) as $a) {
        if (!is_array($a)) continue;
        $icon = in_array($a['icon'] ?? '', ROOM_ICONS, true) ? $a['icon'] : 'shield';
        $label = trim((string)($a['label'] ?? ''));
        if ($label !== '') $am[] = ['icon' => $icon, 'label' => $label];
    }
    $r['amenities'] = $am;

    $f = is_array($in['features'] ?? null) ? $in['features'] : [];
    foreach (['desk', 'shower', 'lounge', 'dining', 'apart'] as $k) {
        $r['features'][$k] = !empty($f[$k]);
    }

    $wanted = slugify((string)($in['id'] ?? ''));
    if ($wanted === '') $wanted = slugify($r['name']);
    $oldId = $old['id'] ?? null;
    foreach ($allRooms as $x) {
        if ($x['id'] === $wanted && $x['id'] !== $oldId) {
            $errors['id'] = 'Another room already uses this URL identifier.';
            break;
        }
    }
    $r['id'] = $wanted;
    $r['rank'] = $old['rank'] ?? 0;
    $r['createdAt'] = $old['createdAt'] ?? time();
    $r['updatedAt'] = time();
    $r['updatedBy'] = $_SESSION['uid'] ?? 'system';

    return [$r, $errors];
}

function room_public(array $r): array {
    $tags = array_merge([$r['category']], $r['tags'] ?? []);
    return [
        'id'          => $r['id'],
        'name'        => $r['name'],
        'category'    => $r['category'],
        'tags'        => implode(' ', array_unique($tags)),
        'badge'       => $r['badge'] ?? ['text' => '', 'style' => 'light'],
        'featured'    => !empty($r['featured']),
        'rank'        => $r['rank'] ?? 0,
        'short'       => $r['short'] ?? '',
        'tagline'     => $r['tagline'] ?? '',
        'description' => $r['description'] ?? '',
        'notes'       => $r['notes'] ?? '',
        'size'        => $r['size'] ?? 0,
        'guests'      => $r['guests'] ?? 0,
        'bed'         => $r['bed'] ?? '',
        'view'        => $r['view'] ?? '',
        'price'       => $r['price'] ?? 0,
        'seasonal'    => $r['seasonal'] ?? [],
        'extraBed'    => $r['extraBed'] ?? ['available' => false, 'price' => 0],
        'image'       => $r['image'] ?? '',
        'imageAlt'    => $r['imageAlt'] ?: ($r['name'] . ' at Unicorn Hospitality'),
        'gallery'     => $r['gallery'] ?? [],
        'amenities'   => $r['amenities'] ?? [],
        'features'    => $r['features'] ?? [],
    ];
}

function media_list(): array {
    $out = [];
    foreach ([['assets/images/unicon/rooms', false], [UPLOAD_REL, true]] as [$rel, $up]) {
        $dir = ROOT_DIR . '/' . $rel;
        if (!is_dir($dir)) continue;
        foreach (scandir($dir) as $f) {
            if (!preg_match('/\.(jpe?g|png|webp|avif)$/i', $f)) continue;
            $p = $dir . '/' . $f;
            if (!is_file($p)) continue;
            $out[] = ['path' => $rel . '/' . $f, 'name' => $f, 'size' => filesize($p), 'uploaded' => $up, 'time' => filemtime($p)];
        }
    }
    usort($out, fn($a, $b) => $b['time'] <=> $a['time']);
    return $out;
}

/* ======================================================================
   8. Small Utility Helpers
   ====================================================================== */
function json_out($payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function h($s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function admin_base_path(): string {
    $dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    return rtrim($dir, '/') . '/';
}

function security_headers(bool $page = true): void {
    header('X-Content-Type-Options: nosniff');
}

function throttle_key(string $username): string { return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . strtolower($username)); }
function throttle_state(string $key): array { return ['count' => 0, 'first' => 0, 'until' => 0]; }
function throttle_fail(string $key): array { return ['count' => 1, 'first' => time(), 'until' => 0]; }
function throttle_clear(string $key): void {}
