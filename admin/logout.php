<?php
/* Sign out (POST only, with the page's security token) */
require __DIR__ . '/includes/bootstrap.php';
security_headers();
start_admin_session();
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok($_POST['csrf'] ?? null)) {
    if (!empty($_SESSION['uid'])) log_activity('logout', 'Signed out', $_SESSION['uid']);
    sign_out();
    header('Location: login.php?out=1');
    exit;
}
header('Location: index.php');
exit;
