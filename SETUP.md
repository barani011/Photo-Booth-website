# Local Photo Saving

## Requirements

- Node.js 18 or newer
- npm
- A camera browser permission for live capture

The Express backend uses `express` for HTTP routes and `qrcode` to generate QR images. Final designed photos are saved to `saved-photos/`; camera captures and finished designs are also uploaded to Supabase when configured.

## Supabase photo storage

The Express server loads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env` and passes them to the browser client through `/api/config`. The local `.env` is ignored by Git. It is prefilled with this workspace's current project settings; use `.env.example` as a template for another project. Use only the publishable anon key here, never a service-role key.

In the Supabase SQL Editor, create the public bucket, metadata table, and anonymous kiosk policies:

```sql
insert into storage.buckets (id, name, public)
values ('booth-photo', 'booth-photo', true)
on conflict (id) do update set public = true;

create table if not exists public.photos (
	id uuid primary key default gen_random_uuid(),
	session_id text not null,
	event_name text,
	image_path text not null unique,
	created_at timestamptz not null default now()
);

alter table public.photos add column if not exists event_name text;

alter table public.photos enable row level security;

grant insert, select on public.photos to anon;

drop policy if exists "Kiosk can upload photo records" on public.photos;
drop policy if exists "Kiosk can return inserted photo records" on public.photos;
drop policy if exists "Kiosk can upload booth photo files" on storage.objects;

create policy "Kiosk can upload photo records"
	on public.photos for insert to anon with check (true);
create policy "Kiosk can return inserted photo records"
	on public.photos for select to anon using (true);
create policy "Kiosk can upload booth photo files"
	on storage.objects for insert to anon
	with check (bucket_id = 'booth-photo');
```

The bucket name must be exactly `booth-photo`. Uploaded objects are stored under a lowercase event-name folder, such as `baranievent/<photo-id>.jpg`. The bucket is public so QR links can be opened without signing in. These anonymous policies are intended for a controlled photo-booth kiosk; use Supabase quotas and monitoring to limit unwanted uploads.

## Start the booth

From this folder, run:

```powershell
npm install
npm start
```

Open `http://localhost:3000` and use the normal template, capture, and share flow. Do not open the HTML files directly with `file://`; the browser needs the server for automatic final-photo saving.

Events created in the launch page are saved in this browser. Select an event and choose **Launch Event**, or create an event with its modal **Launch Event** button. Each completed design is rendered as a full-resolution JPG using its paper size and DPI, then saved automatically in `saved-photos/<event-name-and-id>/`. Filenames begin with a sanitized event name and include a timestamp and UUID, so images from different events stay separate and existing photos are never overwritten.

The share page shows the event and saved filename. Select **Scan QR** to display a QR code that opens the matching photo download page. With Supabase configured, it serves the cloud copy; otherwise it falls back to the local server copy.

## Phone downloads

With Supabase configured, QR codes point directly to the public photo and phones only need internet access. If cloud upload is unavailable, the local download fallback requires the phone and booth computer to be on the same reachable network. The server selects a private IPv4 address for fallback QR links. If the computer has multiple network adapters, set `PUBLIC_BASE_URL` to the booth's reachable address before starting the server:

```powershell
$env:PUBLIC_BASE_URL = "http://192.168.1.25:3000"
npm start
```

Replace the example address with the booth computer's actual LAN address. The operating-system firewall must allow inbound connections to the selected port. A QR link using `localhost`, `127.0.0.1`, or a `file://` URL cannot be opened from another phone.

## Upload API and testing

`POST /api/photos?eventId=...&eventName=...` accepts a raw `image/jpeg` or `image/png` body, validates its file signature, limits uploads to 32 MB, and saves it in the validated event folder with a unique generated filename. It responds with `filename`, `eventFolder`, `eventName`, `downloadUrl`, and `qrCodeDataUrl`. Download routes validate both folder and filename before serving a file from `saved-photos/`.

To test the full flow, start the server, create or select an event, launch it, complete a capture, and confirm the share page displays the event folder and an event-prefixed `photo-...jpg` name. Use **Scan QR** on a phone connected to the same reachable network; the QR opens a preview and **Download photo** link. The existing template editor's browser auto-save remains unchanged; the filesystem backend remains enabled as a local fallback.
