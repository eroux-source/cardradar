-- Hide graded singles, plush and accessories picked up before the catalog filter was tightened.
UPDATE listings SET active = 0 WHERE
  title LIKE '% PSA %' OR title LIKE '% PSA' OR title LIKE 'PSA %' OR title LIKE '%PSA 1%' OR title LIKE '%PSA 9%' OR title LIKE '%PSA 8%'
  OR title LIKE '% BGS %' OR title LIKE '% CGC %' OR title LIKE '%graded%' OR title LIKE '%gradiert%' OR title LIKE '% slab%'
  OR title LIKE '%plush%' OR title LIKE '%plüsch%' OR title LIKE '%peluche%' OR title LIKE '%kuscheltier%'
  OR title LIKE '%code card%' OR title LIKE '%online code%' OR title LIKE '%poster%' OR title LIKE '%art print%' OR title LIKE '%jumbo card%';
UPDATE skus SET active = 0 WHERE NOT EXISTS (SELECT 1 FROM listings l WHERE l.sku_id = skus.id AND l.active = 1);
