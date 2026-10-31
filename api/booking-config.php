<?php
/* ======================================================================
   Unicorn Hospitality - BOOKING SETTINGS (edit this file to change rules)
   Database login lives in admin/includes/config.php (not here).
   Room names, prices, images, capacity, amenities and inventory live in the MySQL `rooms` table
   and are edited from the admin dashboard.
   ====================================================================== */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

return [
    /* ---- Booking ID: PREFIX-XXXXXXXX (letters/numbers, no look-alike characters) ---- */
    'booking_id_prefix' => 'UCH',
    'booking_id_length' => 8,

    /* ---- Status given to a new booking: 'confirmed' or 'pending'.
          'pending' holds the room for pending_hold_minutes and then releases it automatically. ---- */
    'default_status'       => 'confirmed',
    'pending_hold_minutes' => 30,

    /* ---- Money ---- */
    'currency_symbol' => "\u{20B9}",
    'tax_percent'     => 0.0,            /* e.g. 12 for 12% GST. 0 = no tax line is added to the total */
    'tax_label'       => 'Taxes & fees',
    'tax_note'        => 'Included',     /* text shown in the summary while tax_percent is 0 */
    'payment_note'    => 'No advance payment is required. Payment is collected at the front desk on check-in.',

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
       To use SMTP: composer require phpmailer/phpmailer in the project root, then set the UCH_SMTP_* environment variables. */
    'email' => [
        'enabled'   => true,
        'from'      => 'stay@uniconhospitality.example',
        'from_name' => 'Unicorn Hospitality Reservations',
        'smtp' => [
            'host'   => getenv('UCH_SMTP_HOST') ?: '',
            'port'   => (int)(getenv('UCH_SMTP_PORT') ?: 587),
            'user'   => getenv('UCH_SMTP_USER') ?: '',
            'pass'   => getenv('UCH_SMTP_PASS') ?: '',
            'secure' => getenv('UCH_SMTP_SECURE') ?: 'tls',
        ],
    ],

    /* Leave empty to detect automatically (used for links inside emails). */
    'site_url' => '',
];
