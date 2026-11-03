<?php
/* ======================================================================
   Unicorn Hospitality - BOOKING SETTINGS (edit this file to change rules)
   Database login lives in admin/includes/config.php (not here).
   Room names, prices, images, capacity, amenities and inventory live in the MySQL `rooms` table
   and are edited from the admin dashboard.
   ====================================================================== */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

/* Secrets (Razorpay keys, e-mail password) are NOT written in this file.
   Put them in api/storage/settings.php (copy api/settings.example.php) or in server environment variables.
   api/storage is blocked from the web and ignored by git. */
$local = is_file(__DIR__ . '/storage/settings.php') ? (require __DIR__ . '/storage/settings.php') : [];
$setting = function (string $key, $default = '') use ($local) {
    $env = getenv($key);
    if ($env !== false && $env !== '') return $env;
    return $local[$key] ?? $default;
};

return [
    /* ---- Booking ID: PREFIX-XXXXXXXX (letters/numbers, no look-alike characters) ---- */
    'booking_id_prefix' => 'UCH',
    'booking_id_length' => 8,

    /* ---- A reservation exists only AFTER the Razorpay payment succeeds.
          While the guest is paying, the room is held for pending_hold_minutes and then released automatically. ---- */
    'pending_hold_minutes' => 30,

    /* ---- Razorpay (https://dashboard.razorpay.com). Keys come from api/storage/settings.php or environment variables.
          Use the TEST keys (rzp_test_...) while you are building, the LIVE keys (rzp_live_...) when you go public. ---- */
    'razorpay' => [
        'key_id'         => $setting('UCH_RAZORPAY_KEY_ID'),
        'key_secret'     => $setting('UCH_RAZORPAY_KEY_SECRET'),
        'webhook_secret' => $setting('UCH_RAZORPAY_WEBHOOK_SECRET'),   /* optional but recommended: a safety net if the guest closes the tab after paying */
        'theme_color'    => '#B9995F',
        'api_base'       => $setting('UCH_RAZORPAY_API_BASE', 'https://api.razorpay.com/v1'),   /* leave as is. Only changed for automated tests */
    ],

    /* ---- Money ---- */
    'currency_symbol' => "\u{20B9}",
    'tax_percent'     => 0.0,            /* e.g. 12 for 12% GST. 0 = no tax line is added to the total */
    'tax_label'       => 'Taxes & fees',
    'tax_note'        => 'Included',     /* text shown in the summary while tax_percent is 0 */
    'payment_note'    => 'Your reservation is confirmed once the online payment (Razorpay) is successful. You will receive a confirmation e-mail with the payment receipt.',

    /* ---- Stay limits ---- */
    'max_nights'       => 30,
    'max_advance_days' => 365,           /* how far ahead guests may book */
    'max_adults'       => 6,
    'max_children'     => 4,
    'check_in_time'    => '2:00 PM',
    'check_out_time'   => '11:00 AM',

    /* ---- Cancellation ---- */
    'cancellation' => [
        'free_until_hours'       => 48,      /* guests can cancel online until this many hours before check-in */
        'allow_late_cancellation' => false,  /* false = after the deadline guests must contact reservations */
        'text' => 'Free cancellation until 48 hours before check-in.',
    ],

    /* ---- Changing a booking online ---- */
    'modification' => [
        'allowed_until_hours'      => 48,    /* same idea: dates and guests can be changed until then */
        'reprice_at_current_rate'  => false, /* false = keep the nightly rate the guest booked at */
    ],

    /* ---- Contact details shown on the booking pages and in emails ---- */
    'contact' => [
        'email'     => 'stay@uniconhospitality.example',
        'phone'     => '+91 99204 00267',
        'phone_tel' => '+919920400267',
    ],
    'hotel' => [
        'name'    => 'Unicorn Hospitality',
        'address' => 'Your street address, City, State',
    ],

    /* ---- Country codes in the phone drop-down (code => label) ---- */
    'country_codes' => [
        '+91' => 'India (+91)', '+1' => 'USA / Canada (+1)', '+44' => 'United Kingdom (+44)', '+971' => 'UAE (+971)',
        '+65' => 'Singapore (+65)', '+61' => 'Australia (+61)', '+49' => 'Germany (+49)', '+33' => 'France (+33)',
        '+966' => 'Saudi Arabia (+966)', '+974' => 'Qatar (+974)', '+977' => 'Nepal (+977)', '+94' => 'Sri Lanka (+94)',
        '+880' => 'Bangladesh (+880)', '+81' => 'Japan (+81)',
    ],

    /* ---- Abuse protection: [max requests, per this many seconds] for each visitor ---- */
    'rate_limit' => [
        'lookup' => [8, 600],
        'create' => [10, 600],
        'action' => [12, 600],
    ],
    'access_token_minutes' => 30,        /* how long a reservation stays open after a successful lookup */

    /* ---- Confirmation email ----
       Without PHPMailer the system uses PHP mail() (needs a working mail setup).
       Set the UCH_SMTP_* values in api/storage/settings.php and a built-in SMTP sender is used (no extra software needed).
       Gmail: host smtp.gmail.com, port 587, secure tls, user = your Gmail, pass = a Google "App password". */
    'email' => [
        'enabled'   => true,
        'from'      => $setting('UCH_MAIL_FROM', 'stay@uniconhospitality.example'),   /* with Gmail this must be the same Gmail address */
        'from_name' => 'Unicorn Hospitality Reservations',
        'notify_admin' => $setting('UCH_ADMIN_EMAIL'),   /* the hotel gets a copy of every new paid booking here. Leave empty to turn off */
        'smtp' => [
            'host'   => $setting('UCH_SMTP_HOST'),
            'port'   => (int)$setting('UCH_SMTP_PORT', 587),
            'user'   => $setting('UCH_SMTP_USER'),
            'pass'   => $setting('UCH_SMTP_PASS'),
            'secure' => $setting('UCH_SMTP_SECURE', 'tls') === 'none' ? '' : $setting('UCH_SMTP_SECURE', 'tls'),   /* 'tls' (port 587), 'ssl' (port 465) or 'none' */
            'verify_tls' => true,                              /* set false only on a local XAMPP that has no CA certificates (see README-BOOKING.md) */
        ],
    ],

    /* Leave empty to detect automatically (used for links inside emails). */
    'site_url' => '',
];
