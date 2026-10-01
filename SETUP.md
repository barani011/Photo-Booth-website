# Local Photo Saving

## Requirements

- Node.js 18 or newer
- npm
- A camera browser permission for live capture

The Express backend uses `express` for HTTP routes and `qrcode` to generate QR images. Final designed photos are saved directly to `saved-photos/`.

## Start the booth

From this folder, run:

```powershell
npm install
npm start
```

Open `http://localhost:3000` and use the normal template, capture, and share flow. Do not open the HTML files directly with `file://`; the browser needs the server for automatic final-photo saving.

Events created in the launch page are saved in this browser. Select an event and choose **Launch Event**, or create an event with its modal **Launch Event** button. Each completed design is rendered as a full-resolution JPG using its paper size and DPI, then saved automatically in `saved-photos/<event-name-and-id>/`. Filenames begin with a sanitized event name and include a timestamp and UUID, so images from different events stay separate and existing photos are never overwritten.

The share page shows the event and saved filename. Select **Scan QR** to display a QR code that opens the matching event photo download page.

## Phone downloads

The phone and booth computer must be on the same reachable network. The server selects a private IPv4 address for QR links. If the computer has multiple network adapters, set `PUBLIC_BASE_URL` to the booth's reachable address before starting the server:

```powershell
$env:PUBLIC_BASE_URL = "http://192.168.1.25:3000"
npm start
```

Replace the example address with the booth computer's actual LAN address. The operating-system firewall must allow inbound connections to the selected port. A QR link using `localhost`, `127.0.0.1`, or a `file://` URL cannot be opened from another phone.

## Upload API and testing

`POST /api/photos?eventId=...&eventName=...` accepts a raw `image/jpeg` or `image/png` body, validates its file signature, limits uploads to 32 MB, and saves it in the validated event folder with a unique generated filename. It responds with `filename`, `eventFolder`, `eventName`, `downloadUrl`, and `qrCodeDataUrl`. Download routes validate both folder and filename before serving a file from `saved-photos/`.

To test the full flow, start the server, create or select an event, launch it, complete a capture, and confirm the share page displays the event folder and an event-prefixed `photo-...jpg` name. Use **Scan QR** on a phone connected to the same reachable network; the QR opens a preview and **Download photo** link. The existing template editor's browser auto-save remains unchanged; final designed images use the filesystem backend.
