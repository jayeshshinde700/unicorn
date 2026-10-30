<?php
/* Unicon Hospitality - enquiry intake for contact.html.
   Validates and sanitises the submission, then stores it in the `enquiries` table (created on first use).
   Responds with JSON; ok:true is returned only after the row has actually been saved. */
require_once dirname(__DIR__) . '/admin/includes/db.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function reply(array $p, int $code = 200): void { http_response_code($code); echo json_encode($p, JSON_UNESCAPED_UNICODE); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(['ok' => false, 'message' => 'Method not allowed.'], 405);

/* honeypot: pretend success to bots without storing anything */
if (trim((string)($_POST['website'] ?? '')) !== '') reply(['ok' => true]);

function clean(string $k, int $max): string {
    $v = (string)($_POST[$k] ?? '');
    $v = preg_replace('/[^\P{C}\n\t]+/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

const ENQUIRY_TYPES = ['rooms', 'general', 'corporate', 'weddings', 'groups', 'offers', 'other'];

$name    = clean('name', 100);
$email   = clean('email', 150);
$phone   = clean('phone', 20);
$type    = clean('enquiry_type', 20);
$checkIn = clean('check_in', 10);
$checkOut = clean('check_out', 10);
$guests  = clean('guests', 4);
$message = clean('message', 2000);
$consent = ($_POST['consent'] ?? '') !== '';

$errors = [];
if (mb_strlen($name) < 2) $errors['name'] = 'Please enter your name.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Please enter a valid email address.';
$digits = preg_replace('/\D/', '', $phone);
if (!preg_match('/^[0-9+\-\s()]+$/', $phone) || strlen($digits) < 7 || strlen($digits) > 15) $errors['phone'] = 'Please enter a valid phone number.';
if (!in_array($type, ENQUIRY_TYPES, true)) $errors['enquiry_type'] = 'Please choose an enquiry type.';
if (mb_strlen($message) < 10) $errors['message'] = 'Please write a few words.';
if (!$consent) $errors['consent'] = 'Consent is required.';

$today = date('Y-m-d');
$validDate = fn(string $d): bool => (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int)substr($d, 5, 2), (int)substr($d, 8, 2), (int)substr($d, 0, 4));
if ($checkIn !== '' && (!$validDate($checkIn) || $checkIn < $today)) $errors['check_in'] = 'Invalid check-in date.';
if ($checkOut !== '' && (!$validDate($checkOut) || $checkOut < $today || ($checkIn !== '' && $checkOut <= $checkIn))) $errors['check_out'] = 'Invalid check-out date.';
if ($guests !== '' && (!ctype_digit($guests) || (int)$guests < 1 || (int)$guests > 1000)) $errors['guests'] = 'Invalid number of guests.';

if ($errors) reply(['ok' => false, 'message' => 'Please check the highlighted fields.', 'errors' => $errors], 422);

try {
    $pdo = db();
    $pdo->exec('CREATE TABLE IF NOT EXISTS enquiries (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        created_at DATETIME NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        enquiry_type VARCHAR(20) NOT NULL,
        check_in DATE NULL,
        check_out DATE NULL,
        guests SMALLINT UNSIGNED NULL,
        message TEXT NOT NULL,
        ip_hash CHAR(64) NOT NULL,
        content_hash CHAR(64) NOT NULL,
        INDEX (created_at), INDEX (ip_hash, created_at), INDEX (content_hash, created_at)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

    $ipHash = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
    $contentHash = hash('sha256', strtolower($email) . '|' . $type . '|' . $message);

    /* duplicate: same content already saved in the last 10 minutes - treat as already received */
    $st = $pdo->prepare('SELECT 1 FROM enquiries WHERE content_hash = ? AND created_at > (NOW() - INTERVAL 10 MINUTE) LIMIT 1');
    $st->execute([$contentHash]);
    if ($st->fetchColumn()) reply(['ok' => true, 'duplicate' => true]);

    /* throttle: at most 5 enquiries per visitor per hour */
    $st = $pdo->prepare('SELECT COUNT(*) FROM enquiries WHERE ip_hash = ? AND created_at > (NOW() - INTERVAL 1 HOUR)');
    $st->execute([$ipHash]);
    if ((int)$st->fetchColumn() >= 5) reply(['ok' => false, 'message' => 'Too many enquiries from this connection. Please call us instead.'], 429);

    $pdo->prepare('INSERT INTO enquiries (created_at, name, email, phone, enquiry_type, check_in, check_out, guests, message, ip_hash, content_hash)
                   VALUES (NOW(),?,?,?,?,?,?,?,?,?,?)')
        ->execute([$name, $email, $phone, $type, $checkIn ?: null, $checkOut ?: null, $guests !== '' ? (int)$guests : null, $message, $ipHash, $contentHash]);
} catch (Throwable $e) {
    error_log('contact.php: ' . $e->getMessage());
    reply(['ok' => false, 'message' => 'We could not save your enquiry just now.'], 500);
}

reply(['ok' => true]);
