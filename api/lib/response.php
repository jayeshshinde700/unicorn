<?php
/* Booking API - bootstrap + JSON helpers. Every endpoint starts with:  require __DIR__ . '/../lib/response.php'; */
if (!defined('UCH_BOOKING')) define('UCH_BOOKING', true);

require_once dirname(__DIR__, 2) . '/admin/includes/db.php';   /* existing PDO connection: db() */
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/availability.php';
require_once __DIR__ . '/booking-functions.php';
require_once __DIR__ . '/mailer.php';

function booking_config(): array {
    static $cfg = null;
    if ($cfg === null) $cfg = require dirname(__DIR__) . '/booking-config.php';
    return $cfg;
}

/* ---------- consistent JSON output ---------- */
function api_send(bool $success, string $message, array $data = [], int $status = 200, array $errors = [], array $top = []): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    $out = ['success' => $success, 'ok' => $success, 'message' => $message] + $top;
    if ($success) $out['data'] = $data ?: new stdClass();
    else $out['errors'] = $errors ?: new stdClass();
    echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}
function api_ok(string $message, array $data = [], int $status = 200): void { api_send(true, $message, $data, $status); }
function api_fail(string $message, int $status = 400, array $errors = []): void { api_send(false, $message, [], $status, $errors); }

/* Log technical details on the server only (api/storage/logs/booking-YYYY-MM.log) */
function api_log(string $where, Throwable|string $err): void {
    $dir = dirname(__DIR__) . '/storage/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $msg = $err instanceof Throwable ? get_class($err) . ': ' . $err->getMessage() : $err;
    @file_put_contents($dir . '/booking-' . date('Y-m') . '.log', '[' . date('c') . "] $where | $msg\n", FILE_APPEND | LOCK_EX);
}

/* Wrap an endpoint so unexpected errors never leak SQL, paths or credentials */
function api_run(callable $fn, string $name): void {
    try { booking_ensure_schema(db()); $fn(); }
    catch (PDOException $e) {
        api_log($name, $e);
        api_fail('We cannot reach the reservation system right now. Please try again in a moment or call our reservations team.', 503);
    } catch (Throwable $e) {
        api_log($name, $e);
        api_fail('Something went wrong on our side. Please try again or contact our reservations team.', 500);
    }
}

/* ---------- request helpers ---------- */
function api_require_method(string ...$methods): void {
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($m, $methods, true)) { header('Allow: ' . implode(', ', $methods)); api_fail('Method not allowed.', 405); }
}

/* JSON body (POST) merged over query string (GET) */
function api_input(): array {
    $in = $_GET;
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        $raw = file_get_contents('php://input');
        if ($raw !== '' && $raw !== false) {
            $j = json_decode($raw, true);
            if (is_array($j)) $in = array_merge($in, $j);
            elseif (!empty($_POST)) $in = array_merge($in, $_POST);
        } elseif (!empty($_POST)) $in = array_merge($in, $_POST);
    }
    return $in;
}

/* CSRF protection for state-changing calls: the request must be same-origin (Origin/Referer host == this host)
   and must be JSON (browsers cannot send cross-site JSON from a plain HTML form). */
function api_require_same_origin(): void {
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src !== '') {
        $h = strtolower((string)parse_url($src, PHP_URL_HOST));
        $p = parse_url($src, PHP_URL_PORT);
        $full = $p ? "$h:$p" : $h;
        if ($full !== $host && $h !== preg_replace('/:\d+$/', '', $host)) api_fail('This request was blocked for your safety.', 403);
    }
    $ct = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
    if (strpos($ct, 'application/json') === false) api_fail('This request was blocked for your safety.', 403);
}

function api_client_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45); }

/* Fixed-window rate limiter stored in MySQL. Stops the request with HTTP 429 when the limit is passed. */
function api_rate_limit(string $action, string $subject = ''): void {
    $cfg = booking_config()['rate_limit'][$action] ?? [10, 600];
    [$max, $window] = $cfg;
    $pdo = db();
    $bucket = hash('sha256', $action . '|' . api_client_ip() . '|' . strtolower($subject));
    $now = time();
    $pdo->beginTransaction();
    try {
        $s = $pdo->prepare('SELECT hits, window_start FROM booking_rate_limits WHERE bucket = ? FOR UPDATE');
        $s->execute([$bucket]);
        $row = $s->fetch();
        if (!$row || $now - (int)$row['window_start'] >= $window) {
            $pdo->prepare('REPLACE INTO booking_rate_limits (bucket, hits, window_start) VALUES (?,1,?)')->execute([$bucket, $now]);
            $pdo->commit();
            if (mt_rand(1, 50) === 1) $pdo->prepare('DELETE FROM booking_rate_limits WHERE window_start < ?')->execute([$now - 86400]);
            return;
        }
        if ((int)$row['hits'] >= $max) {
            $pdo->commit();
            header('Retry-After: ' . max(1, $window - ($now - (int)$row['window_start'])));
            api_fail('Too many attempts. Please wait a few minutes and try again.', 429);
        }
        $pdo->prepare('UPDATE booking_rate_limits SET hits = hits + 1 WHERE bucket = ?')->execute([$bucket]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
