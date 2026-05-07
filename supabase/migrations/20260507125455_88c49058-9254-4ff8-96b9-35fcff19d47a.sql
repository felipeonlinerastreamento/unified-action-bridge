-- Enable RLS on realtime.messages and restrict subscriptions to authenticated users.
-- Postgres changes broadcasts are still filtered by each source table's RLS,
-- so users only receive rows they can already SELECT.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime broadcasts" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime broadcasts" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);