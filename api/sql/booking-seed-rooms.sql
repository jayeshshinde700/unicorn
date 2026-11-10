-- ============================================================
-- OPTIONAL seed: adds the five starting rooms ONLY if a room with that id does not exist yet.
-- Existing rooms are never changed. Prices, images and everything else can then be edited in the admin dashboard.
-- Inventory = how many rooms of that type the hotel has.
-- ============================================================
INSERT INTO `rooms` (`id`,`name`,`category`,`status`,`featured`,`price`,`size`,`guests`,`rank_no`,`data`,`created_at`,`updated_at`)
SELECT v.id, v.name, v.category, 'published', 0, v.price, v.size, v.guests, v.rank_no,
       JSON_OBJECT('id', v.id, 'name', v.name, 'category', v.category, 'tags', JSON_ARRAY(), 'badge', JSON_OBJECT('text','','style','light'),
                   'status','published','featured', FALSE, 'short','', 'tagline','', 'description','', 'notes','Check-in from 2:00 PM, check-out by 11:00 AM.',
                   'size', v.size, 'guests', v.guests, 'bed', v.bed, 'view','', 'inventory', v.inventory,
                   'extraBed', JSON_OBJECT('available', FALSE, 'price', 0), 'price', v.price,
                   'seasonal', JSON_OBJECT('festive',NULL,'winter',NULL,'summer',NULL,'monsoon',NULL),
                   'image', v.image, 'imageAlt', v.name, 'gallery', JSON_ARRAY(), 'amenities', JSON_ARRAY(),
                   'features', JSON_OBJECT('desk',FALSE,'shower',FALSE,'lounge',FALSE,'dining',FALSE,'apart',FALSE), 'rank', v.rank_no),
       UNIX_TIMESTAMP(), UNIX_TIMESTAMP()
FROM (
  SELECT 'deluxe' id, 'Deluxe Room' name, 'room' category, 4500 price, 32 size, 2 guests, 'King bed' bed, 12 inventory, 1 rank_no, 'assets/images/unicon/rooms/uni-deluxe.png' image
  UNION ALL SELECT 'executive','Executive Room','room',5800,38,2,'King bed',8,2,'assets/images/unicon/rooms/uni-executive.png'
  UNION ALL SELECT 'family','Family Suite','suite',8200,52,4,'2 twin beds',4,3,'assets/images/unicon/rooms/uni-family.png'
  UNION ALL SELECT 'premium','Premium Suite','suite',9800,60,3,'King bed',3,4,'assets/images/unicon/rooms/uni-premium.png'
  UNION ALL SELECT 'unicon','The Unicon Suite','suite',14500,85,4,'King bed + lounge',1,5,'assets/images/unicon/rooms/uni-unicon.png'
) v
WHERE NOT EXISTS (SELECT 1 FROM `rooms` r WHERE r.id = v.id);
