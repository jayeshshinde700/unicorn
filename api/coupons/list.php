<?php
/* GET api/coupons/list.php - public list for coupons.html: coupons that are switched on, marked "show on coupons page"
   and either running now or starting soon. Hidden coupons are never returned. */
require __DIR__ . '/../lib/response.php';
api_require_method('GET');

api_run(function () {
    $pdo = db();
    $out = [];
    foreach ($pdo->query('SELECT * FROM coupons WHERE is_active = 1 AND is_public = 1 ORDER BY created_at DESC, id DESC')->fetchAll() as $c) {
        $state = coupon_state($pdo, $c);
        if (!in_array($state, ['active', 'scheduled'], true)) continue;
        $out[] = [
            'code' => $c['code'], 'title' => $c['title'], 'description' => $c['description'], 'headline' => coupon_headline($c),
            'type' => $c['discount_type'], 'value' => (float)$c['discount_value'], 'terms' => coupon_terms($c), 'state' => $state,
            'startsOn' => $c['valid_from'], 'validTo' => $c['valid_to'],
        ];
    }
    api_ok('Coupons', ['coupons' => $out]);
}, 'coupon-list');
