<?php
/* Booking API - confirmation email. A failed email NEVER cancels a saved booking; the result is stored in bookings.email_status:
   'sent' | 'failed' | 'disabled'. */
if (!defined('UCH_BOOKING')) { http_response_code(403); exit; }

function mail_money(float $n): string { return booking_config()['currency_symbol'] . number_format($n, 0, '.', ','); }
function mail_date(string $d): string { return date('D, d M Y', strtotime($d)); }
function mail_h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function booking_email_body(array $b, string $kind): array {
    $cfg = booking_config();
    $link = booking_site_url() . '/find-my-reservation.html?id=' . rawurlencode($b['bookingId']);
    $title = ['created' => 'Your reservation is confirmed', 'modified' => 'Your reservation was updated', 'cancelled' => 'Your reservation was cancelled'][$kind] ?? 'Your reservation';
    if ($kind === 'created' && $b['status'] === 'pending') $title = 'We have received your reservation request';
    $guests = $b['stay']['adults'] . ' adult' . ($b['stay']['adults'] > 1 ? 's' : '') . ($b['stay']['children'] ? ', ' . $b['stay']['children'] . ' child' . ($b['stay']['children'] > 1 ? 'ren' : '') : '');
    $rows = [
        'Booking ID' => $b['bookingId'], 'Status' => ucfirst($b['status']), 'Room' => $b['room']['name'],
        'Check-in' => mail_date($b['stay']['checkIn']) . ' (from ' . $cfg['check_in_time'] . ')',
        'Check-out' => mail_date($b['stay']['checkOut']) . ' (by ' . $cfg['check_out_time'] . ')',
        'Nights' => (string)$b['stay']['nights'], 'Guests' => $guests, 'Total' => mail_money($b['pricing']['total']),
    ];
    $text = "Dear {$b['guest']['firstName']},\n\n$title.\n\n";
    foreach ($rows as $k => $v) $text .= str_pad($k . ':', 12) . $v . "\n";
    $text .= "\n" . $cfg['payment_note'] . "\n\nView or manage your reservation: $link\n(You will need your Booking ID and this email address.)\n\nQuestions? Call {$cfg['contact']['phone']} or write to {$cfg['contact']['email']}.\n\n{$cfg['hotel']['name']}\n";
    $html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1c2a25"><h2 style="font-family:Georgia,serif;color:#1F3A33">' . mail_h($title) . '</h2><p>Dear ' . mail_h($b['guest']['firstName']) . ',</p><table style="width:100%;border-collapse:collapse">';
    foreach ($rows as $k => $v) $html .= '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666;width:120px">' . mail_h($k) . '</td><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>' . mail_h($v) . '</strong></td></tr>';
    $html .= '</table><p>' . mail_h($cfg['payment_note']) . '</p><p><a href="' . mail_h($link) . '" style="background:#B9995F;color:#14231e;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:bold">Find my reservation</a></p><p style="color:#666;font-size:13px">Questions? Call ' . mail_h($cfg['contact']['phone']) . ' or write to ' . mail_h($cfg['contact']['email']) . '.</p></div>';
    return [$title, $text, $html];
}

/* Returns 'sent', 'failed' or 'disabled'. Never throws. */
function booking_send_email(array $b, string $kind = 'created'): string {
    $cfg = booking_config()['email'];
    if (empty($cfg['enabled'])) return 'disabled';
    @ini_set('default_socket_timeout', '3');   /* never keep a guest waiting on a mail server that is down */
    try {
        [$subject, $text, $html] = booking_email_body($b, $kind);
        $subject .= ' - ' . $b['bookingId'];
        $to = $b['guest']['email'];
        if (preg_match('/[\r\n]/', $to . $cfg['from'] . $cfg['from_name'])) return 'failed';

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
            return 'sent';
        }

        /* plain PHP mail() - works only when the server has a mail transport configured */
        $boundary = 'b' . bin2hex(random_bytes(8));
        $headers = "From: =?UTF-8?B?" . base64_encode($cfg['from_name']) . "?= <{$cfg['from']}>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"$boundary\"";
        $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n$text\r\n--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n$html\r\n--$boundary--";
        if (stripos(PHP_OS, 'WIN') === 0) {            /* on Windows/XAMPP mail() talks to an SMTP server: check it is there first so guests are not kept waiting */
            $sock = @fsockopen((string)ini_get('SMTP'), (int)ini_get('smtp_port'), $en, $es, 1);
            if (!$sock) { api_log('mail', 'No SMTP server reachable at ' . ini_get('SMTP') . ':' . ini_get('smtp_port') . ' for booking ' . $b['bookingId']); return 'failed'; }
            fclose($sock);
        }
        $ok = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
        if (!$ok) api_log('mail', 'mail() returned false for booking ' . $b['bookingId'] . ' (no mail server configured?)');
        return $ok ? 'sent' : 'failed';
    } catch (Throwable $e) {
        api_log('mail', $e);
        return 'failed';
    }
}
