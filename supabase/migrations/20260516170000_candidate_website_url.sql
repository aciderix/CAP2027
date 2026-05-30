-- Optional website URL per candidate (party site, campaign site, etc.).
-- Displayed on the fiche, after the party name. Nullable — admin fills
-- it in via the Candidates page when relevant. Plain text URL; we
-- validate in the UI by trying new URL() before rendering.

alter table public.candidates add column if not exists website_url text;
