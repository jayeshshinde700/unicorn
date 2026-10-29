<?php
/* Unicorn Hospitality admin - database layer (MySQL / MariaDB through PDO).
   Tables: admin_users, admin_activity, admin_attempts, rooms, site_meta.
   Created automatically the first time anything needs them. Older file data in admin/data/ is imported once. */
require_once __DIR__ . '/config.php';

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
    $base = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4';
    try {
        $pdo = new PDO($base . ';dbname=' . DB_NAME, DB_USER, DB_PASS, $opts);
    } catch (PDOException $e) {
        if ((int)$e->getCode() !== 1049) throw $e;                       /* 1049 = database does not exist yet */
        $tmp = new PDO($base, DB_USER, DB_PASS, $opts);
        $tmp->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', DB_NAME) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        $pdo = new PDO($base . ';dbname=' . DB_NAME, DB_USER, DB_PASS, $opts);
    }
    if (!$pdo->query("SHOW TABLES LIKE 'site_meta'")->fetchColumn()) db_install($pdo);
    return $pdo;
}

function db_install(PDO $pdo): void {
    $t = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_users (
        username VARCHAR(30) NOT NULL PRIMARY KEY, name VARCHAR(60) NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at INT UNSIGNED NOT NULL) $t");
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_activity (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, t INT UNSIGNED NOT NULL, username VARCHAR(40) NOT NULL, action VARCHAR(40) NOT NULL,
        detail VARCHAR(200) NOT NULL DEFAULT '', ip VARCHAR(45) NOT NULL DEFAULT '', KEY idx_t (t)) $t");
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_attempts (
        k CHAR(64) NOT NULL PRIMARY KEY, cnt INT UNSIGNED NOT NULL DEFAULT 0, first_at INT UNSIGNED NOT NULL DEFAULT 0, locked_until INT UNSIGNED NOT NULL DEFAULT 0) $t");
    $pdo->exec("CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(40) NOT NULL PRIMARY KEY, name VARCHAR(60) NOT NULL, category ENUM('room','suite') NOT NULL DEFAULT 'room',
        status ENUM('published','draft') NOT NULL DEFAULT 'draft', featured TINYINT(1) NOT NULL DEFAULT 0,
        price INT UNSIGNED NOT NULL, size INT UNSIGNED NOT NULL, guests TINYINT UNSIGNED NOT NULL, rank_no INT NOT NULL DEFAULT 0,
        data LONGTEXT NOT NULL, created_at INT UNSIGNED NOT NULL, updated_at INT UNSIGNED NOT NULL,
        KEY idx_status_rank (status, rank_no)) $t");
    $pdo->exec("CREATE TABLE IF NOT EXISTS site_meta (k VARCHAR(40) NOT NULL PRIMARY KEY, v VARCHAR(255) NOT NULL) $t");
    db_import_files($pdo);
    $pdo->prepare('INSERT INTO site_meta (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)')->execute(['installed', (string)time()]);
}

/* one-time import of the older file storage (admin/data/*.data.php), so no account or room is lost */
function db_import_files(PDO $pdo): void {
    $read = function (string $name) {
        $f = DATA_DIR . '/' . $name . '.data.php';
        if (!is_file($f)) return null;
        $raw = file_get_contents($f); $guard = "<?php http_response_code(404); exit; ?>\n";
        if (strpos($raw, $guard) === 0) $raw = substr($raw, strlen($guard));
        return json_decode($raw, true);
    };
    $now = time();
    try {
        $pdo->beginTransaction();
        $u = $read('users');
        foreach (($u['users'] ?? []) as $x) {
            if (empty($x['username']) || empty($x['hash'])) continue;
            $pdo->prepare('INSERT IGNORE INTO admin_users (username, name, password_hash, created_at) VALUES (?,?,?,?)')
                ->execute([strtolower($x['username']), $x['name'] ?? $x['username'], $x['hash'], (int)($x['createdAt'] ?? $now)]);
        }
        $r = $read('rooms');
        if (!empty($r['rooms']) && is_array($r['rooms'])) {
            foreach ($r['rooms'] as $room) if (is_array($room) && !empty($room['id'])) db_put_room($pdo, $room);
            db_meta_set($pdo, 'rooms_saved', '1'); db_meta_set($pdo, 'rooms_updated', (string)($r['updated'] ?? $now));
        }
        $a = $read('activity');
        if (is_array($a)) foreach (array_reverse($a) as $x)
            $pdo->prepare('INSERT INTO admin_activity (t, username, action, detail, ip) VALUES (?,?,?,?,?)')
                ->execute([(int)($x['t'] ?? $now), substr((string)($x['user'] ?? 'system'), 0, 40), substr((string)($x['action'] ?? ''), 0, 40), substr((string)($x['detail'] ?? ''), 0, 200), substr((string)($x['ip'] ?? ''), 0, 45)]);
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); }
}

/* ---------- small key/value settings ---------- */
function db_meta_set(PDO $pdo, string $k, string $v): void {
    $pdo->prepare('INSERT INTO site_meta (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)')->execute([$k, $v]);
}
function meta_get(string $k): ?string {
    $s = db()->prepare('SELECT v FROM site_meta WHERE k = ?'); $s->execute([$k]);
    $v = $s->fetchColumn(); return $v === false ? null : (string)$v;
}

/* ---------- users ---------- */
function users_all(): array {
    $rows = db()->query('SELECT username, name, password_hash, created_at FROM admin_users ORDER BY created_at, username')->fetchAll();
    return array_map(fn($u) => ['username' => $u['username'], 'name' => $u['name'], 'hash' => $u['password_hash'], 'createdAt' => (int)$u['created_at']], $rows);
}
function users_exist(): bool { return (int)db()->query('SELECT COUNT(*) FROM admin_users')->fetchColumn() > 0; }
function user_save_all(array $users): void {
    $pdo = db(); $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('INSERT INTO admin_users (username, name, password_hash, created_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)');
        $keep = [];
        foreach ($users as $u) { $st->execute([$u['username'], $u['name'], $u['hash'], (int)($u['createdAt'] ?? time())]); $keep[] = $u['username']; }
        if ($keep) $pdo->prepare('DELETE FROM admin_users WHERE username NOT IN (' . implode(',', array_fill(0, count($keep), '?')) . ')')->execute($keep);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}

/* ---------- sign-in throttle ---------- */
function throttle_key(string $username): string { return hash('sha256', client_ip() . '|' . strtolower($username)); }
function throttle_state(string $key): array {
    $s = db()->prepare('SELECT cnt, first_at, locked_until FROM admin_attempts WHERE k = ?'); $s->execute([$key]);
    $r = $s->fetch(); $row = $r ? ['count' => (int)$r['cnt'], 'first' => (int)$r['first_at'], 'until' => (int)$r['locked_until']] : ['count' => 0, 'first' => 0, 'until' => 0];
    if ($row['until'] && $row['until'] < time()) $row = ['count' => 0, 'first' => 0, 'until' => 0];
    if ($row['first'] && time() - $row['first'] > ADMIN_LOCK_SECONDS) $row = ['count' => 0, 'first' => 0, 'until' => 0];
    return $row;
}
function throttle_fail(string $key): array {
    $pdo = db();
    $pdo->prepare('DELETE FROM admin_attempts WHERE locked_until < ? AND first_at < ?')->execute([time(), time() - ADMIN_LOCK_SECONDS]);
    $row = throttle_state($key);
    if (!$row['first']) $row['first'] = time();
    $row['count']++;
    if ($row['count'] >= ADMIN_MAX_FAILS) $row['until'] = time() + ADMIN_LOCK_SECONDS;
    $pdo->prepare('INSERT INTO admin_attempts (k, cnt, first_at, locked_until) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE cnt = VALUES(cnt), first_at = VALUES(first_at), locked_until = VALUES(locked_until)')
        ->execute([$key, $row['count'], $row['first'], $row['until']]);
    return $row;
}
function throttle_clear(string $key): void { db()->prepare('DELETE FROM admin_attempts WHERE k = ?')->execute([$key]); }

/* ---------- activity log ---------- */
function log_activity(string $action, string $detail = '', ?string $user = null): void {
    $pdo = db();
    $pdo->prepare('INSERT INTO admin_activity (t, username, action, detail, ip) VALUES (?,?,?,?,?)')
        ->execute([time(), substr($user ?? ($_SESSION['uid'] ?? 'system'), 0, 40), substr($action, 0, 40), mb_substr($detail, 0, 160), client_ip()]);
    $pdo->exec('DELETE FROM admin_activity WHERE id <= (SELECT m FROM (SELECT IF(MAX(id) > 200, MAX(id) - 200, 0) AS m FROM admin_activity) x)');
}
function activity_recent(int $n = 80): array {
    $s = db()->prepare('SELECT t, username, action, detail, ip FROM admin_activity ORDER BY id DESC LIMIT ' . max(1, min(200, $n))); $s->execute();
    return array_map(fn($a) => ['t' => (int)$a['t'], 'user' => $a['username'], 'action' => $a['action'], 'detail' => $a['detail'], 'ip' => $a['ip']], $s->fetchAll());
}

/* ---------- rooms ---------- */
function db_put_room(PDO $pdo, array $r): void {
    $pdo->prepare('INSERT INTO rooms (id, name, category, status, featured, price, size, guests, rank_no, data, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), status = VALUES(status), featured = VALUES(featured), price = VALUES(price), size = VALUES(size),
        guests = VALUES(guests), rank_no = VALUES(rank_no), data = VALUES(data), updated_at = VALUES(updated_at)')
        ->execute([$r['id'], $r['name'], $r['category'] === 'suite' ? 'suite' : 'room', ($r['status'] ?? '') === 'published' ? 'published' : 'draft', !empty($r['featured']) ? 1 : 0,
            (int)$r['price'], (int)$r['size'], (int)$r['guests'], (int)($r['rank'] ?? 0),
            json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (int)($r['createdAt'] ?? time()), (int)($r['updatedAt'] ?? time())]);
}
function rooms_saved(): bool { return meta_get('rooms_saved') === '1'; }
function rooms_updated(): ?int { $v = meta_get('rooms_updated'); return $v === null ? null : (int)$v; }
function rooms_load(): array {
    $rows = db()->query('SELECT data FROM rooms ORDER BY rank_no, id')->fetchAll(PDO::FETCH_COLUMN);
    if (!$rows && !rooms_saved()) return seed_rooms();               /* nothing saved yet: show the starter rooms */
    $out = [];
    foreach ($rows as $j) { $r = json_decode($j, true); if (is_array($r)) $out[] = $r; }
    return $out;
}
function rooms_save(array $rooms): void {
    usort($rooms, fn($a, $b) => ($a['rank'] ?? 0) <=> ($b['rank'] ?? 0));
    $pdo = db(); $pdo->beginTransaction();
    try {
        $ids = array_column($rooms, 'id');
        if ($ids) $pdo->prepare('DELETE FROM rooms WHERE id NOT IN (' . implode(',', array_fill(0, count($ids), '?')) . ')')->execute($ids);
        else $pdo->exec('DELETE FROM rooms');
        foreach ($rooms as $r) db_put_room($pdo, $r);
        db_meta_set($pdo, 'rooms_saved', '1'); db_meta_set($pdo, 'rooms_updated', (string)time());
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}
