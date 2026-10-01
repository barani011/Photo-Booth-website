const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const QRCode = require('qrcode');

const SAVE_DIR = path.join(__dirname, 'saved-photos');
const PORT = Number(process.env.PORT) || 3000;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const app = express();
const publicPages = new Set([
  'camera-settings.html',
  'capture-settings.html',
  'capture.html',
  'download.html',
  'gallery.html',
  'index.html',
  'kiosk.html',
  'photo-layout.html',
  'share.html',
  'template.html'
]);

fs.mkdirSync(SAVE_DIR, { recursive: true });

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  const addresses = Object.values(interfaces)
    .flatMap(entries => entries || [])
    .filter(entry => entry.family === 'IPv4' && !entry.internal);
  const address = addresses.find(entry =>
    /^10\./.test(entry.address)
    || /^192\.168\./.test(entry.address)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(entry.address)
  );
  return address?.address || 'localhost';
}

function getPublicBaseUrl() {
  const configuredUrl = process.env.PUBLIC_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  return `http://${getLanAddress()}:${PORT}`;
}

function toSafeSlug(value, maximumLength = 48) {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maximumLength)
    .replace(/-+$/g, '') || 'event';
}

function getEventFolder(eventId, eventName) {
  if (typeof eventId !== 'string' || !eventId.trim() || eventId.length > 120) return null;
  if (typeof eventName !== 'string' || !eventName.trim() || eventName.length > 120) return null;
  const eventIdSlug = toSafeSlug(eventId, 80);
  return `${toSafeSlug(eventName)}--${eventIdSlug.slice(-32)}`;
}

function isSafeEventFolder(value) {
  return typeof value === 'string'
    && value.length <= 82
    && /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(value);
}

function isSafePhotoFilename(value) {
  return typeof value === 'string'
    && path.basename(value) === value
    && /^photo-[a-z0-9][a-z0-9-]{0,47}-\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png)$/.test(value);
}

function detectImageType(buffer) {
  if (buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  return null;
}

function resolvePhotoPath(eventFolder, filename) {
  if (!isSafeEventFolder(eventFolder) || !isSafePhotoFilename(filename)) return null;
  const eventPath = path.resolve(SAVE_DIR, eventFolder);
  const photoPath = path.resolve(eventPath, filename);
  if (!eventPath.startsWith(`${SAVE_DIR}${path.sep}`)
    || !photoPath.startsWith(`${eventPath}${path.sep}`)) return null;
  return photoPath;
}

app.get('/api/config', (req, res) => {
  res.json({ publicBaseUrl: getPublicBaseUrl() });
});

app.post('/api/photos', express.raw({
  type: ['image/jpeg', 'image/png'],
  limit: MAX_IMAGE_BYTES
}), async (req, res, next) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Upload a JPG or PNG image.' });
  }
  const imageType = detectImageType(req.body);
  if (!imageType || imageType.contentType !== req.get('Content-Type')) {
    return res.status(415).json({ error: 'Image content must match its JPG or PNG content type.' });
  }

  const { eventId, eventName } = req.query;
  const eventFolder = getEventFolder(eventId, eventName);
  if (!eventFolder) return res.status(400).json({ error: 'A valid event ID and name are required.' });

  const filename = `photo-${toSafeSlug(eventName)}-${Date.now()}-${crypto.randomUUID()}.${imageType.extension}`;
  const photoPath = resolvePhotoPath(eventFolder, filename);
  if (!photoPath) return res.status(400).json({ error: 'The event or image name is invalid.' });

  try {
    await fs.promises.mkdir(path.dirname(photoPath), { recursive: true });
    await fs.promises.writeFile(photoPath, req.body, { flag: 'wx' });
    const publicBaseUrl = getPublicBaseUrl();
    const downloadUrl = `${publicBaseUrl}/download.html?event=${encodeURIComponent(eventFolder)}&file=${encodeURIComponent(filename)}`;
    const qrCodeDataUrl = await QRCode.toDataURL(downloadUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320
    });
    res.status(201).json({ filename, eventName, eventFolder, downloadUrl, qrCodeDataUrl });
  } catch(error) {
    if (error.code === 'EEXIST') {
      return res.status(409).json({ error: 'Could not allocate a unique photo filename. Please retry.' });
    }
    next(error);
  }
});

app.get('/photos/:eventFolder/:filename', (req, res) => {
  const photoPath = resolvePhotoPath(req.params.eventFolder, req.params.filename);
  if (!photoPath || !fs.existsSync(photoPath)) return res.sendStatus(photoPath ? 404 : 400);
  res.type(path.extname(photoPath)).sendFile(photoPath);
});

app.get('/api/photos/:eventFolder/:filename', (req, res) => {
  const photoPath = resolvePhotoPath(req.params.eventFolder, req.params.filename);
  if (!photoPath || !fs.existsSync(photoPath)) return res.sendStatus(photoPath ? 404 : 400);
  res.download(photoPath, req.params.filename);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/:page', (req, res, next) => {
  if (!publicPages.has(req.params.page)) return next();
  res.sendFile(path.join(__dirname, req.params.page));
});
app.get('/:asset', (req, res, next) => {
  if (!/^[a-z0-9_-]+\.css$/i.test(req.params.asset)) return next();
  const assetPath = path.join(__dirname, req.params.asset);
  if (!fs.existsSync(assetPath)) return next();
  res.type('text/css').sendFile(assetPath);
});

app.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Image exceeds the 32 MB upload limit.' });
  }
  console.error(error);
  res.status(500).json({ error: 'The photo could not be saved.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LumaBooth server listening on http://localhost:${PORT}`);
  console.log(`Phone download base URL: ${getPublicBaseUrl()}`);
  console.log(`Photos are saved in: ${SAVE_DIR}`);
});
