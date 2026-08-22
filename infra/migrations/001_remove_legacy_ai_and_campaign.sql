-- Avveckla tabeller från tidigare AI-/kampanj-/publiceringsfunktioner.
-- Funktionerna och deras routes tas bort i samma release.
DROP TABLE IF EXISTS newsletter_sends;
DROP TABLE IF EXISTS newsletter_subscribers;
DROP TABLE IF EXISTS civic_letter_drafts;
DROP TABLE IF EXISTS daily_api_usage;
DROP TABLE IF EXISTS public_letters;
