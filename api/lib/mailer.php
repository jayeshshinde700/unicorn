<?php
/* Booking API - e-mails. A failed e-mail NEVER cancels a saved booking; the result is stored in bookings.email_status:
   'sent' | 'failed' | 'disabled'.
   Sending order: PHPMailer (if installed with Composer) -> built-in SMTP sender (if UCH_SMTP_HOST is set) -> PHP mail().
   Kinds: 'created' (paid + confirmed), 'modified', 'cancelled', 'soldout' (paid but the room was gone: refunded). */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

function mail_money(float $n): string { return booking_config()['currency_symbol'] . number_format($n, 0, '.', ','); }
function mail_date(string $d): string { return date('D, d M Y', strtotime($d)); }
function mail_h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

/* Wording and details of each e-mail. Edit the texts here. Returns [subject, plain text, html]. */
function booking_email_body(array $b, string $kind): array {
    $cfg = booking_config();
    $link = booking_site_url() . '/find-my-reservation.html?id=' . rawurlencode($b['bookingId']);
    $titles = [
        'created' => 'Your reservation is confirmed', 'modified' => 'Your reservation was updated',
        'cancelled' => 'Your reservation was cancelled', 'soldout' => 'We could not confirm your reservation',
    ];
    $title = $titles[$kind] ?? 'Your reservation';
    $pay = $b['payment'];
    $guests = $b['stay']['adults'] . ' adult' . ($b['stay']['adults'] > 1 ? 's' : '') . ($b['stay']['children'] ? ', ' . $b['stay']['children'] . ' child' . ($b['stay']['children'] > 1 ? 'ren' : '') : '');

    $intro = '';
    if ($kind === 'created') $intro = 'Thank you for booking with us. Your payment was received and your room is reserved.';
    if ($kind === 'soldout') $intro = 'Your payment arrived just after the last room for these dates was taken, so we could not confirm the booking. Your full payment is being refunded.';
    if ($kind === 'cancelled') $intro = 'Your reservation has been cancelled.';

    $rows = [
        'Booking ID' => $b['bookingId'], 'Status' => ucfirst($b['status']), 'Room' => $b['room']['name'],
        'Check-in' => mail_date($b['stay']['checkIn']) . ' (from ' . $cfg['check_in_time'] . ')',
        'Check-out' => mail_date($b['stay']['checkOut']) . ' (by ' . $cfg['check_out_time'] . ')',
        'Nights' => (string)$b['stay']['nights'], 'Guests' => $guests,
        'Room charges' => mail_money($b['pricing']['subtotal']),
    ];
    if ($b['pricing']['discount'] > 0) $rows['Coupon ' . $b['pricing']['couponCode']] = '- ' . mail_money($b['pricing']['discount']);
    if ($b['pricing']['taxAmount'] > 0) $rows[$cfg['tax_label']] = mail_money($b['pricing']['taxAmount']);
    $rows['Total'] = mail_money($b['pricing']['total']);
    if ($pay['paidAmount'] !== null && $kind !== 'soldout') {
        $rows['Paid online'] = mail_money($pay['paidAmount']);
        if ($pay['paymentId']) $rows['Payment ID'] = $pay['paymentId'];
    }
    if ($pay['refundedAmount'] > 0) $rows['Refund'] = mail_money($pay['refundedAmount']) . ' (reaches your account in 5-7 working days)';

    $text = "Dear {$b['guest']['firstName']},\n\n$title.\n" . ($intro ? "$intro\n" : '') . "\n";
    foreach ($rows as $k => $v) $text .= str_pad($k . ':', 16) . $v . "\n";
    if ($kind === 'created' || $kind === 'modified') $text .= "\nCancellation: " . $cfg['cancellation']['text'] . "\n\nView or manage your reservation: $link\n(You will need your Booking ID and this e-mail address.)\n";
    $text .= "\nQuestions? Call {$cfg['contact']['phone']} or write to {$cfg['contact']['email']}.\n\n{$cfg['hotel']['name']}\n";

    $html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1c2a25"><h2 style="font-family:Georgia,serif;color:#1F3A33">' . mail_h($title) . '</h2><p>Dear ' . mail_h($b['guest']['firstName']) . ',</p>'
        . ($intro ? '<p>' . mail_h($intro) . '</p>' : '') . '<table style="width:100%;border-collapse:collapse">';
    foreach ($rows as $k => $v) $html .= '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666;width:130px">' . mail_h($k) . '</td><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>' . mail_h($v) . '</strong></td></tr>';
    $html .= '</table>';
    if ($kind === 'created' || $kind === 'modified') {
        $html .= '<p style="color:#666;font-size:13px">' . mail_h($cfg['cancellation']['text']) . '</p><p><a href="' . mail_h($link) . '" style="background:#B9995F;color:#14231e;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:bold">Find my reservation</a></p>';
    }
    $html .= '<p style="color:#666;font-size:13px">Questions? Call ' . mail_h($cfg['contact']['phone']) . ' or write to ' . mail_h($cfg['contact']['email']) . '.</p></div>';
    return [$title, $text, $html];
}

/* Returns 'sent', 'failed' or 'disabled'. Never throws. */
function booking_send_email(array $b, string $kind = 'created'): string {
    $cfg = booking_config()['email'];
    if (empty($cfg['enabled'])) return 'disabled';
    [$subject, $text, $html] = booking_email_body($b, $kind);
    return mail_deliver($b['guest']['email'], $subject . ' - ' . $b['bookingId'], $text, $html, 'booking ' . $b['bookingId']) ? 'sent' : 'failed';
}

/* A short plain notice for the hotel's own inbox (config: email.notify_admin). Never throws. */
function booking_send_hotel_copy(array $b, string $kind): void {
    $cfg = booking_config();
    $to = $cfg['email']['notify_admin'];
    if (empty($cfg['email']['enabled']) || $to === '') return;
    $text = "New reservation (paid online)\n\nBooking ID: {$b['bookingId']}\nGuest: {$b['guest']['firstName']} {$b['guest']['lastName']}\nPhone: {$b['guest']['phoneCountry']} {$b['guest']['phone']}\nEmail: {$b['guest']['email']}\n"
        . "Room: {$b['room']['name']}\nStay: {$b['stay']['checkIn']} to {$b['stay']['checkOut']} ({$b['stay']['nights']} nights)\nGuests: {$b['stay']['adults']} adults, {$b['stay']['children']} children\n"
        . 'Total paid: ' . mail_money((float)$b['pricing']['total']) . ($b['pricing']['couponCode'] ? " (coupon {$b['pricing']['couponCode']})" : '') . "\n"
        . ($b['guest']['specialRequests'] !== '' ? "Special requests: {$b['guest']['specialRequests']}\n" : '')
        . "\nManage it in the admin dashboard: " . booking_site_url() . "/admin/index.php#/reservations\n";
    mail_deliver($to, 'New booking ' . $b['bookingId'] . ' - ' . $b['room']['name'], $text, '<pre style="font-family:Arial,sans-serif">' . mail_h($text) . '</pre>', 'hotel copy ' . $b['bookingId']);
}

/* The actual sending. Returns true/false, never throws. */
function mail_deliver(string $to, string $subject, string $text, string $html, string $what): bool {
    $cfg = booking_config()['email'];
    @ini_set('default_socket_timeout', '8');   /* never keep a guest waiting for long on a mail server that is down */
    try {
        if (preg_match('/[\r\n]/', $to . $subject . $cfg['from'] . $cfg['from_name'])) return false;

        $auto = dirname(__DIR__, 2) . '/vendor/autoload.php';
        if (is_file($auto)) require_once $auto;
        if (class_exists('PHPMailer\\PHPMailer\\PHPMailer') && $cfg['smtp']['host'] !== '') {
            $m = new PHPMailer\PHPMailer\PHPMailer(true);
            $m->isSMTP(); $m->Host = $cfg['smtp']['host']; $m->Port = $cfg['smtp']['port']; $m->SMTPAuth = $cfg['smtp']['user'] !== '';
            $m->Username = $cfg['smtp']['user']; $m->Password = $cfg['smtp']['pass'];
            $m->SMTPSecure = $cfg['smtp']['secure']; $m->CharSet = 'UTF-8';
            $m->setFrom($cfg['from'], $cfg['from_name']); $m->addAddress($to);
            $m->isHTML(true); $m->Subject = $subject; $m->Body = $html; $m->AltBody = $text;
            $m->send();
            return true;
        }

        [$headers, $body] = mail_build_message($to, $subject, $text, $html);
        if ($cfg['smtp']['host'] !== '') {                 /* built-in SMTP: no extra software needed */
            mail_smtp_send($cfg, $to, $headers, $body);
            return true;
        }

        /* plain PHP mail() - works only when the server has a mail transport configured */
        if (stripos(PHP_OS, 'WIN') === 0) {            /* on Windows/XAMPP mail() talks to an SMTP server: check it is there first so guests are not kept waiting */
            $sock = @fsockopen((string)ini_get('SMTP'), (int)ini_get('smtp_port'), $en, $es, 1);
            if (!$sock) { api_log('mail', 'No mail server set up, so the e-mail for ' . $what . ' was not sent. Add UCH_SMTP_* to api/storage/settings.php.'); return false; }
            fclose($sock);
        }
        $ok = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
        if (!$ok) api_log('mail', 'mail() returned false for ' . $what . ' (no mail server configured?)');
        return $ok;
    } catch (Throwable $e) {
        api_log('mail', $what . ' | ' . $e->getMessage());
        return false;
    }
}

/* Headers + a multipart text/HTML body. */
function mail_build_message(string $to, string $subject, string $text, string $html): array {
    $cfg = booking_config()['email'];
    $boundary = 'b' . bin2hex(random_bytes(8));
    $headers = 'From: =?UTF-8?B?' . base64_encode($cfg['from_name']) . "?= <{$cfg['from']}>\r\n"
        . "To: <$to>\r\nSubject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\nDate: " . date('r') . "\r\n"
        . 'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . (preg_replace('/^.*@/', '', $cfg['from']) ?: 'localhost') . ">\r\n"
        . "MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"$boundary\"";
    $part = fn(string $type, string $content) => "--$boundary\r\nContent-Type: $type; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($content));
    return [$headers, $part('text/plain', $text) . $part('text/html', $html) . "--$boundary--\r\n"];
}

/* Minimal SMTP client (AUTH LOGIN, STARTTLS or SSL). Throws RuntimeException with the server's answer when something is refused. */
function mail_smtp_send(array $cfg, string $to, string $headers, string $body): void {
    $s = $cfg['smtp'];
    $ctx = stream_context_create(['ssl' => ['verify_peer' => !empty($s['verify_tls']), 'verify_peer_name' => !empty($s['verify_tls'])]]);
    $fp = @stream_socket_client(($s['secure'] === 'ssl' ? 'ssl://' : 'tcp://') . $s['host'] . ':' . $s['port'], $errno, $errstr, 8, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) throw new RuntimeException("SMTP connect failed: $errstr ($errno)");
    stream_set_timeout($fp, 10);
    $read = function () use ($fp): array {
        $all = ''; $code = 0;
        while (($line = fgets($fp, 1024)) !== false) {
            $all .= $line; $code = (int)substr($line, 0, 3);
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return [$code, trim($all)];
    };
    $cmd = function (string $c, array $ok) use ($fp, $read): void {
        if ($c !== '') fwrite($fp, $c . "\r\n");
        [$code, $msg] = $read();
        if (!in_array($code, $ok, true)) throw new RuntimeException('SMTP error ' . $code . ' after "' . (str_starts_with($c, 'AUTH') || strlen($c) > 40 ? '...' : $c) . '": ' . $msg);
    };
    try {
        $cmd('', [220]);
        $cmd('EHLO localhost', [250]);
        if ($s['secure'] === 'tls') {
            $cmd('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('SMTP: could not start TLS (see README-BOOKING.md, "e-mail on XAMPP")');
            $cmd('EHLO localhost', [250]);
        }
        if ($s['user'] !== '') {
            $cmd('AUTH LOGIN', [334]);
            $cmd(base64_encode($s['user']), [334]);
            $cmd(base64_encode($s['pass']), [235]);
        }
        $cmd('MAIL FROM:<' . $cfg['from'] . '>', [250]);
        $cmd('RCPT TO:<' . $to . '>', [250, 251]);
        $cmd('DATA', [354]);
        $data = preg_replace('/^\./m', '..', $headers . "\r\n\r\n" . $body);
        fwrite($fp, $data . "\r\n.\r\n");
        [$code, $msg] = $read();
        if ($code !== 250) throw new RuntimeException('SMTP error ' . $code . ' after message: ' . $msg);
        @fwrite($fp, "QUIT\r\n");
    } finally {
        fclose($fp);
    }
}
