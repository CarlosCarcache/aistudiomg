# Architecture
- Keep project categories linked to the existing catalog categories; shared folders use the same taxonomy without duplicating category records.
- Shared-gallery orders validate token ownership and image selection inside the database function, and store immutable image/price snapshots on each order so totals are counted once.
- Resolve private shared-gallery images on the server only after validating the share capability; never open the entire storage bucket to visitors.