# CAP 2027

S'informer, comparer, choisir pour l'élection présidentielle française de 2027.

App mobile Android (Capacitor + React + Vite) adossée à Supabase
(Postgres, Auth, Edge Functions, FCM via Firebase) avec un dashboard
admin web (Netlify).

## Stack

- **Frontend mobile** : React 19, Vite 6, Tailwind v4, Capacitor 8, TanStack Query.
- **Backend** : Supabase (Postgres 17, RLS, pg_cron, pg_net, Storage),
  fonctions Deno côté edge (ingest RSS, notifs FCM, parrainages).
- **Admin** : `admin/` — React + Vite déployé sur Netlify.
- **CI** : GitHub Actions pour la build Android et l'ingest RSS via
  Python (sources qui bloquent l'IP Supabase).

## Lancer en local

```sh
npm install
cp .env.example .env.local        # remplir VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                       # web
npx cap run android               # appli native (Android Studio requis)
```

Pour l'admin :

```sh
cd admin && npm install && npm run dev
```

## Structure

- `src/` — appli mobile (React)
- `admin/` — dashboard admin web
- `supabase/migrations/` — schéma Postgres + RLS + cron + triggers
- `supabase/functions/` — edge functions (Deno) :
  `ingest-rss`, `ingest-from-xml`, `notify-after-ingest`,
  `push-broadcast`, `dispatch-election-reminders`,
  `fetch-parrainages`
- `android/` — projet natif Capacitor
- `scripts/` — `ingest_external_rss.py` (workflow GitHub Actions)
