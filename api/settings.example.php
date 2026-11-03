<?php
/* Copy this file to  api/storage/settings.php  and fill in your values. That folder is blocked from the web and ignored by git,
   so your secrets never end up on the website or in the repository.  (Do NOT put real keys in THIS example file.) */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

return [
    /* Razorpay -> Dashboard -> Account & Settings -> API Keys. Start with the TEST keys. */
    'UCH_RAZORPAY_KEY_ID'         => 'rzp_test_xxxxxxxxxxxxxx',
    'UCH_RAZORPAY_KEY_SECRET'     => 'xxxxxxxxxxxxxxxxxxxxxxxx',
    /* Razorpay -> Webhooks -> add  https://YOUR-DOMAIN/api/payments/webhook.php  with events payment.captured, order.paid, refund.processed.
       Choose a secret there and paste the same secret here. */
    'UCH_RAZORPAY_WEBHOOK_SECRET' => '',

    /* E-mail that sends the confirmation to the guest (Gmail example) */
    'UCH_SMTP_HOST'   => 'smtp.gmail.com',
    'UCH_SMTP_PORT'   => 587,
    'UCH_SMTP_SECURE' => 'tls',
    'UCH_SMTP_USER'   => 'yourhotel@gmail.com',
    'UCH_SMTP_PASS'   => 'google-app-password',
    'UCH_MAIL_FROM'   => 'yourhotel@gmail.com',

    /* The hotel gets a copy of every new paid booking at this address (optional) */
    'UCH_ADMIN_EMAIL' => 'reservations@yourhotel.com',
];
