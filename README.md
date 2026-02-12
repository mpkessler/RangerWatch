# RangerWatch

A mobile-first PWA map where users **anonymously** report park ranger sightings by dropping pins. No accounts, no logins — just drop a pin and go.

## Features

- **Anonymous pins** tagged as Sighting / Warning / Ticket
- **Anti-duplicate** logic using PostGIS ST_DWithin (25 m / 90 min window)
- **Check-ins** on existing pins (within 90 min, 10-min cooldown per device)
- **Recency filter** — 24h (default), 2d, 3d, 7d, 30d, 90d
- **Recently mode** — live view of last-90-minute pins with check-in list
- **Media uploads** — image (≤ 8 MB) or video (≤ 25 MB) via Supabase Storage
- **Rate limiting** — 3 pins / hour per device
- **PWA** — installable on iOS and Android, service worker shell cache
- **iOS install banner** — prompts Safari users to add to Home Screen
- **Admin panel** at `/admin` (Basic Auth)

---

## Prerequisites

- **Node.js** 18+
- **Supabase** account (free tier works)
- **Vercel** account (for deployment)

---

## 1 — Supabase setup

### 1.1 Create a project

Go to [supabase.com](https://supabase.com), create a new project, and note your **Project URL** and keys.

### 1.2 Enable PostGIS

In the Supabase dashboard → **Database → Extensions**, enable `postgis`.

Or run via the SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 1.3 Run migrations

Open **SQL Editor** and run the three migration files in order:

```
supabase/migrations/001_enable_postgis.sql
supabase/migrations/002_create_tables.sql
supabase/migrations/003_create_indexes.sql
```

You can also use the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase db push
```

### 1.4 Create Storage bucket

In the Supabase dashboard → **Storage**:

1. Create a new bucket named **`media`**.
2. Set it to **Public**.
3. Add a bucket policy to allow public reads and authenticated (anon-key) uploads:

```sql
-- Allow public reads
CREATE POLICY "Public read media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Allow anon uploads (MVP)
CREATE POLICY "Anon upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media');
```

---

## 2 — Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only, never exposed to client

ADMIN_USER=admin
ADMIN_PASS=choose-a-strong-password
```

**Where to find the keys:**
Supabase dashboard → **Project Settings → API**

---

## 3 — Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Dev tip — blank screen after refresh:** The service worker is disabled in `dev` mode (production only). If you previously ran a production build locally and the SW is still registered, open **DevTools → Application → Service Workers → Unregister**, then **Application → Storage → Clear site data**. Normal refreshes work fine in `dev` after that.

---

## 4 — PWA icons

The repo ships an SVG icon at `public/icons/icon.svg`.
For production you should generate PNG icons:

```bash
# Using sharp (one-time script, not included):
npx @squoosh/cli --resize '{width:192}' -d public/icons public/icons/icon.svg
npx @squoosh/cli --resize '{width:512}' -d public/icons public/icons/icon.svg
```

Rename the output files to `icon-192.png` and `icon-512.png`.

---

## 5 — Deploy to Vercel

### 5.1 Push to GitHub

```bash
git init
git add .
git commit -m "Initial RangerWatch"
git remote add origin https://github.com/your-user/rangerwatch.git
git push -u origin main
```

### 5.2 Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your repo.
2. Add the same environment variables from step 2.
3. Deploy.

Vercel auto-detects Next.js — no extra configuration needed.

---

## Architecture

```
app/
├── api/
│   ├── anon/route.ts           POST — assign anon_user_number
│   ├── sightings/route.ts      GET + POST — list / create sightings
│   ├── nearby/route.ts         GET — duplicate-check before showing form
│   ├── checkins/route.ts       POST — check in on a sighting
│   └── admin/delete/route.ts   POST — soft-delete (Basic Auth)
├── admin/page.tsx              Admin dashboard (Basic Auth via middleware)
├── layout.tsx                  Root layout + SW registration
└── page.tsx                    Main map SPA

components/
├── MapView.tsx                 MapLibre GL map with OSM tiles + clustering
├── TopBar.tsx                  Filter dropdown + Recently toggle
├── ReportButton.tsx            FAB / drop-mode cancel button
├── PinDetailSheet.tsx          Bottom sheet — pin detail + check-in
├── RecentlyList.tsx            90-min live list (Recently mode)
├── ReportForm.tsx              New sighting form with media upload
└── IOSInstallBanner.tsx        iOS Safari install prompt

lib/
├── types.ts                    Shared TypeScript types
├── utils.ts                    Tag colours, time formatting, validation
├── device.ts                   device_uuid + anon_user_number init
├── supabase-client.ts          Browser Supabase client (anon key)
└── supabase-server.ts          Server Supabase client (service role key)

supabase/migrations/
├── 001_enable_postgis.sql
├── 002_create_tables.sql       counters, sightings, checkins, RPC functions
└── 003_create_indexes.sql

public/
├── manifest.json               PWA manifest
├── sw.js                       Service worker
└── icons/icon.svg              App icon (SVG)
```

---

## Admin panel

Visit `/admin` in your browser. The browser will prompt for Basic Auth credentials (`ADMIN_USER` / `ADMIN_PASS`).

- Lists last 200 sightings with tag, coordinates, device UUID, anon number, and check-in count.
- Shows top devices by post volume (last 24h) to spot spammers.
- One-click soft-delete (sets `is_deleted = true`; never hard-deletes).

---

## Anti-spam details

| Rule | Implementation |
|---|---|
| 3 pins / hour / device | Server checks `sightings` where `device_uuid = ?` and `created_at > now() - 1h` |
| No duplicate within 25 m / 90 min | PostGIS `ST_DWithin(location, point, 25)` + `created_at > now() - 90m` |
| Check-in cooldown (10 min) | Server checks `checkins` where `device_uuid = ?` and `sighting_id = ?` and `created_at > now() - 10m` |
| Check-in window (90 min) | `sighting.created_at + 90m > now()` checked server-side |

---

## License

MIT
