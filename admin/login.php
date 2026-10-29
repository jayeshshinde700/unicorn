<?php
/* Unicorn Hospitality - admin sign-in (and the one-time first account setup) */
require __DIR__ . '/includes/bootstrap.php';
security_headers();
start_admin_session();

$setup = !users_exist();
if (!$setup && current_user()) { header('Location: index.php'); exit; }

$error = ''; $notice = ''; $locked = 0; $field = '';
if (isset($_GET['expired'])) $notice = 'Your session ended. Please sign in again.';
if (isset($_GET['out'])) $notice = 'You have been signed out.';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = trim((string)($_POST['username'] ?? ''));
    $pass = (string)($_POST['password'] ?? '');

    if (!csrf_ok($_POST['csrf'] ?? null)) {
        $error = 'This page was open for too long. Please try again.';
    } elseif ($setup) {
        $name = trim((string)($_POST['name'] ?? ''));
        $pass2 = (string)($_POST['password2'] ?? '');
        if (!ADMIN_REMOTE_SETUP && !is_local_request()) {
            $error = 'The first account can only be created from the computer that runs this website.';
        } elseif (mb_strlen($name) < 2 || mb_strlen($name) > 60) { $error = 'Please enter your name (2 to 60 characters).'; $field = 'name'; }
        elseif (!preg_match('/^[A-Za-z0-9._-]{3,30}$/', $user)) { $error = 'The username needs 3 to 30 letters, numbers, dots, dashes or underscores.'; $field = 'username'; }
        elseif (mb_strlen($pass) < ADMIN_MIN_PASSWORD) { $error = 'Use a password with at least ' . ADMIN_MIN_PASSWORD . ' characters.'; $field = 'password'; }
        elseif (strcasecmp($pass, $user) === 0) { $error = 'The password should not be the same as the username.'; $field = 'password'; }
        elseif (!hash_equals($pass, $pass2)) { $error = 'The two passwords do not match.'; $field = 'password2'; }
        else {
            $u = ['username' => strtolower($user), 'name' => $name, 'hash' => password_hash($pass, PASSWORD_DEFAULT), 'createdAt' => time()];
            user_save_all([$u]);
            sign_in($u);
            log_activity('setup', 'Admin account created', $u['username']);
            header('Location: index.php'); exit;
        }
    } else {
        $key = throttle_key($user);
        $st = throttle_state($key);
        if ($st['until'] > time()) {
            $locked = $st['until'] - time();
            $error = 'Too many wrong attempts. Please wait before trying again.';
        } else {
            $found = null;
            foreach (users_all() as $u) if (strcasecmp($u['username'], $user) === 0) { $found = $u; break; }
            /* always run a hash check so the time taken does not reveal whether the username exists */
            $hash = $found['hash'] ?? '$2y$10$Yc6ATJGeHgVa49Iaw3XZKepllWgYqBE9BINeqSGlMe/KplwRQQ8Fq';
            $ok = password_verify($pass, $hash) && $found;
            if ($ok) {
                throttle_clear($key);
                if (password_needs_rehash($found['hash'], PASSWORD_DEFAULT)) {
                    $all = users_all(); foreach ($all as &$x) if ($x['username'] === $found['username']) $x['hash'] = password_hash($pass, PASSWORD_DEFAULT); unset($x);
                    user_save_all($all);
                }
                sign_in($found);
                log_activity('login', 'Signed in', $found['username']);
                header('Location: index.php'); exit;
            }
            usleep(random_int(350000, 700000));
            $row = throttle_fail($key);
            log_activity('login-failed', 'Wrong password for "' . mb_substr($user, 0, 30) . '"', 'visitor');
            if ($row['until'] > time()) { $locked = $row['until'] - time(); $error = 'Too many wrong attempts. Please wait before trying again.'; }
            else $error = 'That username or password is not right.';
        }
    }
}
$csrf = csrf_token();
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title><?= $setup ? 'Set up your admin' : 'Sign in' ?> | Unicorn Hospitality Admin</title>
    <link rel="icon" href="../assets/images/unicon/logos.jpeg" type="image/x-icon">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../assets/css/style.css">
    <link rel="stylesheet" href="assets/admin.css">
</head>
<body class="lg-body">
<div class="lg">
    <aside class="lg__art" aria-hidden="true">
        <img src="../assets/images/unicon/banner/1.jpg" alt="">
        <div class="lg__art-in">
            <div class="lg__brand"><span class="lg__brand-n">Unicorn</span><span class="lg__brand-s">Hospitality</span></div>
            <div class="lg__quote">
                <span class="lg__tag">Admin Studio</span>
                <h2>Every room, <em>beautifully</em> in your hands.</h2>
                <p>Add new rooms, update prices for the season, swap pictures and publish in a few clicks.</p>
            </div>
            <ul class="lg__dots"><li></li><li></li><li></li></ul>
        </div>
    </aside>

    <main class="lg__panel">
        <form class="lg__card<?= $error ? ' is-error' : '' ?>" method="post" action="login.php" id="lgForm" novalidate>
            <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
            <div class="lg__lock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>
            <h1><?= $setup ? 'Create your admin account' : 'Welcome back' ?></h1>
            <p class="lg__sub"><?= $setup ? 'This is a one-time step. You will use these details to manage the rooms on your website.' : 'Sign in to manage your rooms and suites.' ?></p>

            <?php if ($notice): ?><div class="lg__msg lg__msg--ok" role="status"><?= h($notice) ?></div><?php endif; ?>
            <?php if ($error): ?><div class="lg__msg lg__msg--err" role="alert" id="lgErr" <?= $locked ? 'data-lock="' . (int)$locked . '"' : '' ?>><span><?= h($error) ?></span><?= $locked ? ' <b class="lg__count"></b>' : '' ?></div><?php endif; ?>

            <?php if ($setup): ?>
            <div class="fld">
                <input type="text" id="lgName" name="name" placeholder=" " autocomplete="name" maxlength="60" value="<?= h($_POST['name'] ?? '') ?>" <?= $field === 'name' ? 'autofocus' : '' ?> required>
                <label for="lgName">Your name</label>
            </div>
            <?php endif; ?>
            <div class="fld">
                <input type="text" id="lgUser" name="username" placeholder=" " autocomplete="username" maxlength="30" value="<?= h($_POST['username'] ?? '') ?>" spellcheck="false" autocapitalize="off" <?= (!$setup || $field === 'username') && !$locked ? 'autofocus' : '' ?> required>
                <label for="lgUser">Username</label>
            </div>
            <div class="fld">
                <input type="password" id="lgPass" name="password" placeholder=" " autocomplete="<?= $setup ? 'new-password' : 'current-password' ?>" <?= $field === 'password' ? 'autofocus' : '' ?> required>
                <label for="lgPass"><?= $setup ? 'Password' : 'Password' ?></label>
                <button type="button" class="fld__eye" id="lgEye" aria-label="Show password" aria-pressed="false"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
            </div>
            <div class="lg__caps" id="lgCaps" hidden>Caps Lock is on</div>

            <?php if ($setup): ?>
            <div class="meter" id="lgMeter" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
            <p class="lg__hint" id="lgMeterTxt">At least <?= ADMIN_MIN_PASSWORD ?> characters. A few random words make a strong password.</p>
            <div class="fld">
                <input type="password" id="lgPass2" name="password2" placeholder=" " autocomplete="new-password" <?= $field === 'password2' ? 'autofocus' : '' ?> required>
                <label for="lgPass2">Repeat password</label>
            </div>
            <?php endif; ?>

            <button type="submit" class="btn btn--gold btn--lg btn--full" id="lgBtn" <?= $locked ? 'disabled' : '' ?>><span><?= $setup ? 'Create account and continue' : 'Sign in' ?></span><i class="btn__spin" aria-hidden="true"></i></button>
            <p class="lg__foot"><a href="../index.html">&larr; Back to the website</a></p>
        </form>
        <p class="lg__legal">Protected area. Sign-in attempts are logged.</p>
    </main>
</div>
<script src="assets/login.js"></script>
</body>
</html>
