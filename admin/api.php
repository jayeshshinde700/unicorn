<?php
/* Unicorn Hospitality - admin API (JSON). Everything here needs a signed-in session; every change needs the CSRF header. */
require_once __DIR__ . '/includes/db.php';
security_headers(false);
start_admin_session();

$user = current_user();
if (!$user) json_out(['ok' => false, 'error' => 'Your session has ended. Please sign in again.', 'login' => true], 401);

$action = (string)($_GET['a'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];
$readOnly = ['bootstrap', 'media', 'activity', 'export'];
if (!in_array($action, $readOnly, true)) {
    if ($method !== 'POST') json_out(['ok' => false, 'error' => 'Use POST for this action.'], 405);
    if (!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) json_out(['ok' => false, 'error' => 'Security check failed. Please reload the page.'], 403);
}
$body = [];
if ($method === 'POST' && $action !== 'upload') {
    $raw = file_get_contents('php://input');
    if (strlen($raw) > 2000000) json_out(['ok' => false, 'error' => 'That request is too large.'], 413);
    $body = json_decode($raw, true);
    if (!is_array($body)) json_out(['ok' => false, 'error' => 'Could not read the request.'], 400);
}

function find_index(array $rooms, string $id): int { foreach ($rooms as $i => $r) if ($r['id'] === $id) return $i; return -1; }
function reindex(array $rooms): array { usort($rooms, fn($a, $b) => $a['rank'] <=> $b['rank']); foreach ($rooms as $i => &$r) $r['rank'] = $i + 1; return $rooms; }
function purge_unused_uploads(array $gone, array $remaining): void {
    $used = [];
    foreach ($remaining as $r) { $used[$r['image']] = 1; foreach ($r['gallery'] as $g) $used[$g] = 1; }
    $paths = array_merge([$gone['image']], $gone['gallery']);
    foreach ($paths as $p) {
        if (!is_string($p) || strpos($p, UPLOAD_REL . '/') !== 0 || isset($used[$p])) continue;
        $file = UPLOAD_DIR . '/' . basename($p);
        if (is_file($file) && dirname(realpath($file)) === realpath(UPLOAD_DIR)) @unlink($file);
    }
}
function fail_fields(array $errors): void { json_out(['ok' => false, 'error' => 'Please check the highlighted fields.', 'errors' => $errors], 422); }

switch ($action) {

    case 'bootstrap':
        $base = rtrim(dirname(admin_base_path()), '/') . '/';
        json_out(['ok' => true, 'user' => ['username' => $user['username'], 'name' => $user['name']], 'csrf' => csrf_token(),
            'rooms' => rooms_load(), 'activity' => activity_recent(80),
            'api' => $base . 'api/rooms.php', 'site' => $base . 'rooms.html', 'icons' => ROOM_ICONS, 'tags' => ROOM_TAGS,
            'uploadMax' => ADMIN_UPLOAD_MAX, 'minPassword' => ADMIN_MIN_PASSWORD, 'idle' => ADMIN_IDLE_TIMEOUT,
            'saved' => rooms_saved()]);

    case 'activity':
        json_out(['ok' => true, 'activity' => activity_recent(80)]);

    case 'media':
        json_out(['ok' => true, 'media' => media_list()]);

    case 'save':
        $in = $body['room'] ?? null;
        if (!is_array($in)) json_out(['ok' => false, 'error' => 'No room data was sent.'], 400);
        $rooms = rooms_load();
        $origId = isset($body['originalId']) && $body['originalId'] !== '' ? (string)$body['originalId'] : null;
        $idx = $origId !== null ? find_index($rooms, $origId) : -1;
        if ($origId !== null && $idx < 0) json_out(['ok' => false, 'error' => 'That room no longer exists. Reload the page.'], 404);
        $old = $idx >= 0 ? $rooms[$idx] : null;
        [$room, $errors] = room_clean($in, $old, $rooms);
        if ($errors) fail_fields($errors);
        if ($old) { $rooms[$idx] = $room; }
        else { $room['rank'] = count($rooms) ? max(array_column($rooms, 'rank')) + 1 : 1; $rooms[] = $room; }
        rooms_save($rooms);
        log_activity($old ? 'room-updated' : 'room-created', $room['name'] . ' (' . $room['status'] . ')');
        json_out(['ok' => true, 'room' => $room]);

    case 'status':
        $rooms = rooms_load(); $idx = find_index($rooms, (string)($body['id'] ?? ''));
        if ($idx < 0) json_out(['ok' => false, 'error' => 'Room not found.'], 404);
        $to = ($body['status'] ?? '') === 'published' ? 'published' : 'draft';
        if ($to === 'published' && ($rooms[$idx]['image'] === '' || $rooms[$idx]['short'] === ''))
            json_out(['ok' => false, 'error' => 'Add a main picture and a short description before publishing this room.'], 422);
        $rooms[$idx]['status'] = $to; $rooms[$idx]['updatedAt'] = time(); $rooms[$idx]['updatedBy'] = $user['username'];
        rooms_save($rooms);
        log_activity($to === 'published' ? 'room-published' : 'room-unpublished', $rooms[$idx]['name']);
        json_out(['ok' => true, 'room' => $rooms[$idx]]);

    case 'delete':
        $rooms = rooms_load(); $idx = find_index($rooms, (string)($body['id'] ?? ''));
        if ($idx < 0) json_out(['ok' => false, 'error' => 'Room not found.'], 404);
        $gone = $rooms[$idx]; array_splice($rooms, $idx, 1);
        $rooms = reindex($rooms);
        rooms_save($rooms);
        purge_unused_uploads($gone, $rooms);
        log_activity('room-deleted', $gone['name']);
        json_out(['ok' => true, 'rooms' => $rooms]);

    case 'duplicate':
        $rooms = rooms_load(); $idx = find_index($rooms, (string)($body['id'] ?? ''));
        if ($idx < 0) json_out(['ok' => false, 'error' => 'Room not found.'], 404);
        $copy = $rooms[$idx];
        $copy['name'] = mb_substr($copy['name'], 0, 52) . ' (copy)';
        $copy['id'] = unique_id(slugify($copy['name']), $rooms);
        $copy['status'] = 'draft'; $copy['featured'] = false;
        $copy['rank'] = max(array_column($rooms, 'rank')) + 1; $copy['createdAt'] = $copy['updatedAt'] = time(); $copy['updatedBy'] = $user['username'];
        $rooms[] = $copy; rooms_save($rooms);
        log_activity('room-duplicated', $rooms[$idx]['name'] . ' > ' . $copy['name']);
        json_out(['ok' => true, 'room' => $copy]);

    case 'reorder':
        $ids = $body['ids'] ?? null; $rooms = rooms_load();
        $have = array_column($rooms, 'id');
        if (!is_array($ids) || count($ids) !== count($have) || array_diff($have, $ids) || array_diff($ids, $have))
            json_out(['ok' => false, 'error' => 'The list changed. Please reload the page.'], 409);
        $pos = array_flip(array_values($ids));
        foreach ($rooms as &$r) $r['rank'] = $pos[$r['id']] + 1; unset($r);
        rooms_save($rooms);
        log_activity('rooms-reordered', 'New order saved');
        json_out(['ok' => true]);

    case 'upload':
        if (empty($_FILES['file']) || !is_array($_FILES['file'])) json_out(['ok' => false, 'error' => 'No picture was received.'], 400);
        $f = $_FILES['file'];
        if (($f['error'] ?? 0) !== UPLOAD_ERR_OK) {
            $msg = in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'That picture is too large.' : 'The upload did not finish. Please try again.';
            json_out(['ok' => false, 'error' => $msg], 400);
        }
        if (!is_uploaded_file($f['tmp_name'])) json_out(['ok' => false, 'error' => 'Upload could not be verified.'], 400);
        if ($f['size'] > ADMIN_UPLOAD_MAX) json_out(['ok' => false, 'error' => 'Pictures must be under ' . round(ADMIN_UPLOAD_MAX / 1048576) . ' MB.'], 413);
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($f['tmp_name']);
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/avif' => 'avif'][$mime] ?? null;
        if (!$ext) json_out(['ok' => false, 'error' => 'Please upload a JPG, PNG, WebP or AVIF picture.'], 415);
        $info = @getimagesize($f['tmp_name']);
        if (!$info || $info[0] < 200 || $info[1] < 200) json_out(['ok' => false, 'error' => 'That picture is too small. Use at least 200 x 200 pixels.'], 422);
        if ($info[0] > 9000 || $info[1] > 9000) json_out(['ok' => false, 'error' => 'That picture is too large. Use at most 9000 x 9000 pixels.'], 422);
        if (!is_dir(UPLOAD_DIR) && !mkdir(UPLOAD_DIR, 0775, true)) json_out(['ok' => false, 'error' => 'Could not create the uploads folder.'], 500);
        $htaccess = UPLOAD_DIR . '/.htaccess';
        if (!is_file($htaccess)) file_put_contents($htaccess, "# pictures only: never run scripts from here\n<FilesMatch \"\\.(php|phtml|phar|php[0-9])$\">\n  Require all denied\n</FilesMatch>\nOptions -Indexes -ExecCGI\n");
        $name = 'u-' . date('Ymd') . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], UPLOAD_DIR . '/' . $name)) json_out(['ok' => false, 'error' => 'Could not save the picture.'], 500);
        log_activity('image-uploaded', $name);
        json_out(['ok' => true, 'path' => UPLOAD_REL . '/' . $name, 'width' => $info[0], 'height' => $info[1], 'size' => (int)$f['size']]);

    case 'password':
        $cur = (string)($body['current'] ?? ''); $new = (string)($body['next'] ?? '');
        $all = users_all(); $i = -1;
        foreach ($all as $k => $u) if ($u['username'] === $user['username']) $i = $k;
        if ($i < 0 || !password_verify($cur, $all[$i]['hash'])) { usleep(500000); json_out(['ok' => false, 'error' => 'Your current password is not right.', 'errors' => ['current' => 'Not right.']], 422); }
        if (mb_strlen($new) < ADMIN_MIN_PASSWORD) json_out(['ok' => false, 'error' => 'Use at least ' . ADMIN_MIN_PASSWORD . ' characters.', 'errors' => ['next' => 'Too short.']], 422);
        if (hash_equals($cur, $new)) json_out(['ok' => false, 'error' => 'Choose a password you have not used just now.', 'errors' => ['next' => 'Same as current.']], 422);
        $all[$i]['hash'] = password_hash($new, PASSWORD_DEFAULT);
        user_save_all($all);
        session_regenerate_id(true);
        log_activity('password-changed', 'Password updated');
        json_out(['ok' => true, 'csrf' => csrf_token()]);

    case 'export':
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="unicorn-rooms-' . date('Y-m-d') . '.json"');
        echo json_encode(['app' => 'unicorn-rooms', 'version' => 1, 'exported' => date('c'), 'rooms' => rooms_load()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        log_activity('exported', 'Rooms downloaded');
        exit;

    case 'import':
        $list = $body['rooms'] ?? null; $mode = ($body['mode'] ?? 'merge') === 'replace' ? 'replace' : 'merge';
        if (!is_array($list) || !count($list) || count($list) > 100) json_out(['ok' => false, 'error' => 'The file has no rooms in it (or more than 100).'], 422);
        $rooms = $mode === 'replace' ? [] : rooms_load(); $errs = [];
        foreach ($list as $n => $in) {
            if (!is_array($in)) { $errs[] = 'Item ' . ($n + 1) . ' is not a room.'; continue; }
            $idx = isset($in['id']) ? find_index($rooms, slugify((string)$in['id'])) : -1;
            $old = $idx >= 0 ? $rooms[$idx] : null;
            [$room, $e] = room_clean($in, $old, $rooms);
            if ($e) { $errs[] = '"' . ($in['name'] ?? 'Item ' . ($n + 1)) . '": ' . implode(' ', array_values($e)); continue; }
            if ($old) $rooms[$idx] = $room;
            else { $room['rank'] = count($rooms) ? max(array_column($rooms, 'rank')) + 1 : 1; $rooms[] = $room; }
        }
        if ($errs) json_out(['ok' => false, 'error' => 'Nothing was imported. ' . implode(' ', array_slice($errs, 0, 3)), 'problems' => $errs], 422);
        $rooms = reindex($rooms); rooms_save($rooms);
        log_activity('imported', count($list) . ' rooms (' . $mode . ')');
        json_out(['ok' => true, 'rooms' => $rooms]);

    default:
        json_out(['ok' => false, 'error' => 'Unknown action.'], 404);
}
