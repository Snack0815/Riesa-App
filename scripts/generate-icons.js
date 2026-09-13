/* Erzeugt App-Icons als PNG ohne externe Abhängigkeiten (reiner Node + zlib). */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function makeCanvas(w, h) {
  const buf = Buffer.alloc(w * h * 4, 0); // transparent
  return {
    w, h, buf,
    set(x, y, r, g, b, a) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      // simple alpha blend over existing
      const srcA = a / 255;
      const dstA = buf[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA <= 0) { buf[i]=0; buf[i+1]=0; buf[i+2]=0; buf[i+3]=0; return; }
      buf[i]   = Math.round((r * srcA + buf[i]   * dstA * (1 - srcA)) / outA);
      buf[i+1] = Math.round((g * srcA + buf[i+1] * dstA * (1 - srcA)) / outA);
      buf[i+2] = Math.round((b * srcA + buf[i+2] * dstA * (1 - srcA)) / outA);
      buf[i+3] = Math.round(outA * 255);
    }
  };
}

function fillRoundedRect(cv, x0, y0, w, h, r, color) {
  const [cr, cg, cb, ca] = color;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const inCorner = (px, py) => {
        const dx = Math.max(0, x0 + r - x, x - (x0 + w - r - 1));
        const dy = Math.max(0, y0 + r - y, y - (y0 + h - r - 1));
        return dx > 0 && dy > 0 && (dx * dx + dy * dy) > r * r;
      };
      if (!inCorner()) cv.set(x, y, cr, cg, cb, ca);
    }
  }
}

function fillCircle(cv, cx, cy, r, color) {
  const [cr, cg, cb, ca] = color;
  const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) cv.set(x, y, cr, cg, cb, ca);
    }
  }
}

function fillRect(cv, x0, y0, w, h, color) {
  const [cr, cg, cb, ca] = color;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) cv.set(x, y, cr, cg, cb, ca);
  }
}

function drawIcon(size, opts) {
  const cv = makeCanvas(size, size);
  const bgRadius = opts.squircle ? size * 0.22 : 0;
  const pad = opts.maskable ? size * 0.14 : 0;

  // Background
  fillRoundedRect(cv, 0, 0, size, size, bgRadius, [18, 20, 26, 255]);
  fillRoundedRect(cv, 0, 0, size, size, bgRadius, [30, 34, 44, 60]);

  // diagonal accent stripe
  const stripeW = size * 0.9;
  for (let i = 0; i < stripeW; i++) {
    fillCircle(cv, size * 0.15 + i, size * 0.85 - i, 0.6, [255, 138, 61, 10]);
  }

  const s = size - pad * 2;
  const ox = pad, oy = pad;

  // Car silhouette (simple side profile), centered
  const bodyColor = [242, 244, 248, 255];
  const accentColor = [255, 138, 61, 255];

  const bw = s * 0.72;
  const bh = s * 0.22;
  const bx = ox + (s - bw) / 2;
  const by = oy + s * 0.46;

  // body
  fillRoundedRect(cv, bx, by, bw, bh, bh * 0.45, bodyColor);
  // cabin
  const cw = bw * 0.5;
  const ch = bh * 1.1;
  const cx = bx + (bw - cw) / 2;
  const cy = by - ch * 0.62;
  fillRoundedRect(cv, cx, cy, cw, ch, ch * 0.4, bodyColor);
  // wheels
  const wr = bh * 0.42;
  fillCircle(cv, bx + bw * 0.24, by + bh, wr, [24, 26, 32, 255]);
  fillCircle(cv, bx + bw * 0.24, by + bh, wr * 0.5, accentColor);
  fillCircle(cv, bx + bw * 0.76, by + bh, wr, [24, 26, 32, 255]);
  fillCircle(cv, bx + bw * 0.76, by + bh, wr * 0.5, accentColor);

  // ground line accent
  fillRoundedRect(cv, bx - bw * 0.08, by + bh + wr * 1.35, bw * 1.16, s * 0.03, s * 0.015, accentColor);

  return encodePNG(size, size, cv.buf);
}

const outDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false, squircle: true },
  { name: 'icon-512.png', size: 512, maskable: false, squircle: true },
  { name: 'icon-180.png', size: 180, maskable: false, squircle: true },
  { name: 'icon-maskable-192.png', size: 192, maskable: true, squircle: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true, squircle: true }
];

targets.forEach((t) => {
  const png = drawIcon(t.size, t);
  fs.writeFileSync(path.join(outDir, t.name), png);
  console.log('wrote', t.name);
});
