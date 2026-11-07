# Architecture

- Keep project categories linked to the existing catalog categories; shared folders use the same taxonomy without duplicating category records.
- Shared-gallery orders validate token ownership and image selection inside the database function, and store immutable image/price snapshots on each order so totals are counted once.
- Category shares expose only images readable by the share creator, including cross-owner category images for database-validated admins; order selection uses the same capability query to prevent mismatched scopes.
- Resolve private shared-gallery images on the server only after validating the share capability; never open the entire storage bucket to visitors.
- AI image generation uses authenticated server functions and the Gateway SDK; keep provider credentials off public endpoints.
- Apply new database changes through Drizzle migrations; legacy Supabase files are historical, not an alternative deploy path.
- Enforce module permissions with restrictive database policies alongside ownership policies, so permissive policies cannot bypass denied actions.
- Keep managed/generated files out of style lint; generators own their formatting.
