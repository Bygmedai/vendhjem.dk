-- BYG-562 C2 · Forespørg på et ophold
-- Person og plads ligger i 0003 og 0007. C2 tilføjer kun det, kvittering
-- og intern mailfejl ikke kan bære i de eksisterende kolonner:
-- den frie besked fra formularen, og den synlige fejl når Resend fejler.
--
-- Remote apply: wrangler d1 migrations apply vendhjem-fonde --remote
-- Denne agent har ikke Cloudflare-token. Steven kører apply, når D1 Write
-- er på det token der deployer. Opfind ikke at tokenet findes her.

ALTER TABLE pladser ADD COLUMN besked TEXT;
ALTER TABLE pladser ADD COLUMN mail_fejl TEXT;
