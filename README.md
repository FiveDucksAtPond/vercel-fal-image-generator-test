<h1 align="center">Replicate × Vercel Image Generator</h1>

An AI image generation app built with Next.js (App Router), the Vercel AI SDK, and Replicate. This README documents everything required to run the project locally from scratch.

Contents
- Prerequisites
- Environment Variables
- Supabase Setup (Auth, DB, Storage)
- Replicate Setup
- Local Development
- Optional: Vercel CLI workflow
- Troubleshooting

## Prerequisites
- Node.js 20 LTS (recommended) or >= 18.18
- A package manager: pnpm (preferred), npm, or yarn
- A Replicate account + API token
- A Supabase project (for auth, image feed, and storage)

## Environment Variables
Create a file named `.env.local` in the project root with the following keys.

Required
- `REPLICATE_API_TOKEN` – your Replicate API token
- `NEXT_PUBLIC_SUPABASE_URL` – your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` – your Supabase service role key (needed for dev signup, storage writes, and server reads)

Optional
- `SUPABASE_BUCKET=images` – storage bucket name (defaults to `images`)
- `NEXT_PUBLIC_DEV_SKIP_EMAIL_CONFIRM=true` – enables dev signup without email confirmation in the UI
- `DEV_AUTH_SKIP_EMAIL_CONFIRM=true` – allows the dev create‑user API route

Example `.env.local`:

```
REPLICATE_API_TOKEN=your_replicate_token

NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_BUCKET=images

NEXT_PUBLIC_DEV_SKIP_EMAIL_CONFIRM=true
DEV_AUTH_SKIP_EMAIL_CONFIRM=true
```

## Supabase Setup (Auth, DB, Storage)
1) Create a Supabase project at https://supabase.com and retrieve:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service role key → `SUPABASE_SERVICE_ROLE_KEY`

2) Enable Email/Password auth (default) in Authentication → Providers.

3) Create tables for profiles and images. In the Supabase SQL editor, run:

```
-- Stores a user’s email + UUID for convenience in the app
create table if not exists public.user_profiles (
  id bigserial primary key,
  user_uuid uuid unique not null,
  email text unique not null,
  created_at timestamptz not null default now()
);

-- Stores generated images for both community and user galleries
create table if not exists public.user_generated_images (
  id bigserial primary key,
  uuid uuid null,                 -- user UUID (nullable for anonymous rows)
  image_url text not null,
  prompt text null,
  created_at timestamptz not null default now()
);
```

Notes
- Row Level Security can remain enabled; server uses the service role key for reads/writes.
- The app queries the `uuid` column for “My Gallery”. Keep that exact column name.

4) Create a public storage bucket (optional; code will attempt to create it):
   - Storage → Create bucket → name: `images` → Public

## Replicate Setup
1) Create an account at https://replicate.com
2) Create an API token and set `REPLICATE_API_TOKEN` in `.env.local`.

## Local Development
1) Install dependencies
   - `pnpm install`
   - or `npm install`

2) Start the dev server (port 3000)
   - `pnpm dev`
   - or `npm run dev`
   - Open http://localhost:3000

3) Sign up / Sign in
   - With `NEXT_PUBLIC_DEV_SKIP_EMAIL_CONFIRM=true` and `DEV_AUTH_SKIP_EMAIL_CONFIRM=true`, you can create a user in dev mode via the “Create account” button (uses the Admin API; requires `SUPABASE_SERVICE_ROLE_KEY`).
   - Otherwise, use normal email confirmation flow; then sign in.

4) Generate images
   - Enter a prompt and submit. Images appear in the output area and are saved to Supabase (if configured) and show up in:
     - Community Creations (homepage feed)
     - My Gallery (`/gallery`) for the signed‑in user

5) Optional: Background image
   - Place your background at `public/background.png` to set a full‑page background (already wired in CSS).

## Optional: Vercel CLI workflow
If you prefer managing environment variables via Vercel:
- `npm i -g vercel` (or `pnpm i -g vercel`)
- `vercel link` → link to your Vercel project
- `vercel env pull` → writes `.env.local`

## Troubleshooting
- Hydration warnings: first paint uses an SSR‑safe placeholder for galleries; reload after setting env vars.
- “Supabase not configured”: ensure all Supabase env vars are set, especially `SUPABASE_SERVICE_ROLE_KEY`.
- Dev signup fails: confirm `NEXT_PUBLIC_DEV_SKIP_EMAIL_CONFIRM=true`, `DEV_AUTH_SKIP_EMAIL_CONFIRM=true`, and that the service role key is present.
- Community/My Gallery empty: verify the SQL tables exist and `user_generated_images.uuid` is populated. New images are saved server‑side after generation.

Contributions are welcome. Feel free to open issues or PRs.


## Dev Admin Bypass (No Login)
To skip manual login on localhost and use a stock account automatically:

- Set these env vars in `.env.local`:
  - `NEXT_PUBLIC_DEV_ADMIN_BYPASS=true`
  - `DEV_AUTH_SKIP_EMAIL_CONFIRM=true`
  - `NEXT_PUBLIC_DEV_STOCK_EMAIL=savelii@gaxos.ai` (optional; defaults to this value)
  - `NEXT_PUBLIC_DEV_STOCK_PASSWORD=dev-password-1234` (optional; defaults to this value)
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set; the app uses it to create the user if missing.
- Start the dev server and open http://localhost:3000. The app will auto-create and sign in the stock account, then hydrate the profile for API requests.
