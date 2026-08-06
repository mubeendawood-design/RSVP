-- Migration 007 — track which household invitations have been sent.
--
-- Powers the "Send invitations" screen (progress + resume across sessions) and
-- later tells the reminder engine who was actually invited. Host-only field,
-- written via the service-role key server-side. Safe to re-run.

alter table households add column if not exists invite_sent_at timestamptz;
