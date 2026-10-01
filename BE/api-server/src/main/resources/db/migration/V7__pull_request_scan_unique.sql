-- Runner callback retries must not create duplicate dashboard PR counts.
-- Keep the oldest row if an older deployment already inserted duplicates.
WITH ranked AS (
    SELECT id,
           row_number() OVER (PARTITION BY scan_id ORDER BY created_at, id) AS row_no
    FROM pull_requests
)
DELETE FROM pull_requests
WHERE id IN (SELECT id FROM ranked WHERE row_no > 1);

CREATE UNIQUE INDEX uq_pull_requests_scan_id ON pull_requests (scan_id);
