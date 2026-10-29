<?php
/* Unicorn Hospitality - admin dashboard (the page shell; the screens are drawn by assets/admin.js) */
require __DIR__ . '/includes/bootstrap.php';
security_headers();
start_admin_session();
if (!users_exist()) { header('Location: login.php'); exit; }
$user = current_user();
if (!$user) { header('Location: login.php?expired=1'); exit; }
$csrf = csrf_token();
$initial = mb_strtoupper(mb_substr($user['name'] ?: $user['username'], 0, 1));
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <meta name="csrf" content="<?= h($csrf) ?>">
    <title>Rooms | Unicorn Hospitality Admin</title>
    <link rel="icon" href="../assets/images/unicon/logos.jpeg" type="image/x-icon">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../assets/css/style.css">
    <link rel="stylesheet" href="assets/admin.css">
</head>
<body class="ad-body">

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <symbol id="ic-bed" viewBox="0 0 24 24"><path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/></symbol>
    <symbol id="ic-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="ic-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></symbol>
    <symbol id="ic-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></symbol>
    <symbol id="ic-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></symbol>
    <symbol id="ic-eye" viewBox="0 0 24 24"><path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="ic-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.200-4.200"/></symbol>
    <symbol id="ic-grip" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/></symbol>
    <symbol id="ic-up" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></symbol>
    <symbol id="ic-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
    <symbol id="ic-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/></symbol>
    <symbol id="ic-upload" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></symbol>
    <symbol id="ic-download" viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></symbol>
    <symbol id="ic-check" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></symbol>
    <symbol id="ic-x" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></symbol>
    <symbol id="ic-logout" viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10"/></symbol>
    <symbol id="ic-key" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l3 3"/></symbol>
    <symbol id="ic-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
    <symbol id="ic-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.600 0l3-3a4 4 0 0 0-5.600-5.600l-1 1M14 10a4 4 0 0 0-5.600 0l-3 3a4 4 0 0 0 5.600 5.600l1-1"/></symbol>
    <symbol id="ic-ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></symbol>
    <symbol id="ic-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
    <symbol id="ic-star" viewBox="0 0 24 24"><path d="m12 3 2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/></symbol>
    <symbol id="ic-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></symbol>
    <symbol id="ic-alert" viewBox="0 0 24 24"><path d="M12 4 2.500 20h19zM12 10v4M12 17v.01"/></symbol>
    <symbol id="ic-save" viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/></symbol>
    <symbol id="ic-rupee" viewBox="0 0 24 24"><path d="M7 5h10M7 9h10M7 5c5 0 7 2 5 5-1 1.500-3 2-5 2l8 7"/></symbol>
    <symbol id="ic-layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/></symbol>
    <symbol id="ic-home" viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v9H4zM10 20v-6h4v6"/></symbol>
    <symbol id="ic-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>
    <symbol id="ic-people" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.500"/><path d="M2 20a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="2.500"/><path d="M18 14a5 5 0 0 1 4 6"/></symbol>
    <symbol id="ic-area" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></symbol>
    <symbol id="ic-shield" viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6z"/><path d="m9 12 2 2 4-4"/></symbol>
    <symbol id="ic-code" viewBox="0 0 24 24"><path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/></symbol>
    <symbol id="ic-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5"/></symbol>
    <!-- amenity icons (same drawings as the website) -->
    <symbol id="am-wifi" viewBox="0 0 24 24"><path d="M2 9a15 15 0 0 1 20 0M5 12.500a10 10 0 0 1 14 0M8.500 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/></symbol>
    <symbol id="am-snow" viewBox="0 0 24 24"><path d="M12 2.500v19M3.800 7.250l16.400 9.500M20.200 7.250l-16.400 9.500M9.500 4.500 12 6.800l2.500-2.300M9.500 19.500 12 17.200l2.500 2.300"/></symbol>
    <symbol id="am-tv" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></symbol>
    <symbol id="am-cup" viewBox="0 0 24 24"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/></symbol>
    <symbol id="am-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></symbol>
    <symbol id="am-bed" viewBox="0 0 24 24"><path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.500"/></symbol>
    <symbol id="am-bath" viewBox="0 0 24 24"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/></symbol>
    <symbol id="am-desk" viewBox="0 0 24 24"><path d="M3 9h18M5 9v10M19 9v10M9 9v5h6V9"/></symbol>
    <symbol id="am-sofa" viewBox="0 0 24 24"><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/></symbol>
    <symbol id="am-drop" viewBox="0 0 24 24"><path d="M12 3s6 6.500 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z"/></symbol>
    <symbol id="am-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300l1.800 1.800M16.900 16.900l1.800 1.800M5.300 18.700l1.800-1.800M16.900 7.100l1.800-1.800"/></symbol>
    <symbol id="am-car" viewBox="0 0 24 24"><path d="M4 16v-4l2-5h12l2 5v4zM4 16v2M20 16v2M4 12h16"/><circle cx="8" cy="14.500" r="1"/><circle cx="16" cy="14.500" r="1"/></symbol>
    <symbol id="am-pool" viewBox="0 0 24 24"><path d="M3 17c2 0 2-1.500 4.500-1.500S10 17 12 17s2.500-1.500 4.500-1.500S19 17 21 17M3 21c2 0 2-1.500 4.500-1.500S10 21 12 21s2.500-1.500 4.500-1.500S19 21 21 21M8 14V6a2 2 0 0 1 4 0M14 14V6a2 2 0 0 1 4 0M8 9h6"/></symbol>
    <symbol id="am-shield" viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6z"/><path d="m9 12 2 2 4-4"/></symbol>
    <symbol id="am-plane" viewBox="0 0 24 24"><path d="M21 3 3 10l7 3 3 7z"/><path d="m10 13 4-4"/></symbol>
    <symbol id="am-gym" viewBox="0 0 24 24"><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/></symbol>
</defs></svg>

<div class="ad" id="ad">
    <div class="ad__scrim" id="scrim"></div>
    <aside class="ad__side" id="side" aria-label="Main menu">
        <a class="ad__brand" href="#/rooms"><span class="n">Unicorn</span><span class="s">Admin Studio</span></a>
        <nav class="ad__nav" id="nav">
            <a href="#/rooms" data-nav="rooms"><svg class="i"><use href="#ic-bed"/></svg><span>Rooms &amp; Suites</span><em class="pill" id="navCount">&ndash;</em></a>
            <a href="#/activity" data-nav="activity"><svg class="i"><use href="#ic-clock"/></svg><span>Activity</span></a>
            <a href="#/backup" data-nav="backup"><svg class="i"><use href="#ic-layers"/></svg><span>Backup &amp; website link</span></a>
            <a href="#/account" data-nav="account"><svg class="i"><use href="#ic-key"/></svg><span>My account</span></a>
        </nav>
        <div class="ad__side-foot">
            <a class="ad__ext" href="../rooms.html" target="_blank" rel="noopener"><svg class="i"><use href="#ic-ext"/></svg><span>View the Rooms page</span></a>
            <div class="ad__user">
                <span class="av"><?= h($initial) ?></span>
                <span class="who"><b><?= h($user['name'] ?: $user['username']) ?></b><small>Administrator</small></span>
                <form method="post" action="logout.php"><input type="hidden" name="csrf" value="<?= h($csrf) ?>"><button type="submit" class="ad__out" title="Sign out" aria-label="Sign out"><svg class="i"><use href="#ic-logout"/></svg></button></form>
            </div>
        </div>
    </aside>

    <div class="ad__main">
        <header class="ad__top">
            <button type="button" class="ad__burger" id="burger" aria-label="Open menu"><svg class="i"><use href="#ic-menu"/></svg></button>
            <div class="ad__title"><span class="crumb" id="crumb">Rooms</span><h1 id="pageTitle">Rooms &amp; Suites</h1></div>
            <div class="ad__actions" id="topActions"></div>
        </header>
        <main class="ad__view" id="view" tabindex="-1" aria-live="polite">
            <div class="skel"><i></i><i></i><i></i></div>
        </main>
    </div>
</div>

<div id="modalRoot"></div>
<div class="toasts" id="toasts" aria-live="polite" aria-atomic="false"></div>
<noscript><p style="padding:24px">This dashboard needs JavaScript. Please turn it on in your browser.</p></noscript>
<script src="assets/admin.js"></script>
</body>
</html>
