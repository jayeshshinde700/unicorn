<?php
/* POST api/bookings/lookup.php - body: {bookingId, email}  OR  {bookingId, token} (token = refreshing a lookup already made in this browser).
   Always answers with the same generic message when the details do not match. */
require __DIR__ . '/../lib/response.php';
api_require_method('POST');
api_require_same_origin();

api_run(function () {
    $in = api_input();
    $pdo = db();
    $id = booking_clean_id($in['bookingId'] ?? '');
    $email = strtolower(v_text($in['email'] ?? '', 190));
    $token = v_text($in['token'] ?? '', 300);

    if ($id === '' || ($email === '' && $token === '')) {
        $errors = [];
        if ($id === '') $errors['bookingId'] = 'Please enter your Booking ID.';
        if ($email === '' && $token === '') $errors['email'] = 'Please enter the email address used for the booking.';
        api_fail('Please enter your Booking ID and email address.', 422, $errors);
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) api_fail('Please enter a valid email address.', 422, ['email' => 'Please enter a valid email address.']);

    api_rate_limit('lookup');                    /* per visitor */
    api_rate_limit('lookup', $id);               /* per booking ID, so one ID cannot be guessed from many places quickly */

    $row = booking_authorize($pdo, ['bookingId' => $id, 'email' => $email, 'token' => $token]);
    if (!$row) api_fail("We couldn't find a reservation matching those details. Please check your Booking ID and email address or contact our reservations team.", 404);

    api_ok('Reservation found', booking_public($pdo, $row, true));
}, 'lookup');
