#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');
const ICONSET_DIR = path.join(BUILD_DIR, 'icon.iconset');

const BG = [0x21, 0x22, 0x25, 0xff];
const FG = [0xf5, 0xd5, 0x47, 0xff];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function roundedRectMask(x, y, size, radiusRatio = 0.21) {
  const r = size * radiusRatio;
  const dx = Math.max(Math.abs(x - size / 2) - (size / 2 - r), 0);
  const dy = Math.max(Math.abs(y - size / 2) - (size / 2 - r), 0);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const edge = r - dist;
  return clamp01(edge + 0.5);
}

function circleMask(x, y, cx, cy, radius) {
  const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  return clamp01(radius - d + 0.5);
}

function capsuleMask(x, y, cx, top, bottom, radius) {
  if (y >= top && y <= bottom) {
    const d = Math.abs(x - cx);
    return clamp01(radius - d + 0.5);
  }
  if (y < top) {
    return circleMask(x, y, cx, top, radius);
  }
  return circleMask(x, y, cx, bottom, radius);
}

function writeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

let crcTable = null;
function makeCrcTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(buf) {
  if (!crcTable) {
    crcTable = makeCrcTable();
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function encodePng(width, height, rgba) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    header,
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', idat),
    writeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createIconPixels(size) {
  const buffer = Buffer.alloc(size * size * 4);
  const dotRadius = size * 0.07;
  const dotY = size * 0.245;
  const centerX = size * 0.5;
  const stemTop = size * 0.36;
  const stemBottom = size * 0.76;
  const stemRadius = size * 0.07;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const xi = x + 0.5;
      const yi = y + 0.5;

      const bgMask = roundedRectMask(xi, yi, size);
      let r = BG[0];
      let g = BG[1];
      let b = BG[2];
      let a = BG[3] * bgMask;

      const dot = circleMask(xi, yi, centerX, dotY, dotRadius);
      const stem = capsuleMask(xi, yi, centerX, stemTop, stemBottom, stemRadius);
      const fgMask = clamp01(Math.max(dot, stem));
      if (fgMask > 0) {
        r = Math.round(r * (1 - fgMask) + FG[0] * fgMask);
        g = Math.round(g * (1 - fgMask) + FG[1] * fgMask);
        b = Math.round(b * (1 - fgMask) + FG[2] * fgMask);
        a = Math.round(Math.max(a, FG[3] * fgMask));
      }

      buffer[i] = r;
      buffer[i + 1] = g;
      buffer[i + 2] = b;
      buffer[i + 3] = Math.round(a);
    }
  }
  return buffer;
}

function writePngFile(filePath, size) {
  const rgba = createIconPixels(size);
  const png = encodePng(size, size, rgba);
  fs.writeFileSync(filePath, png);
  return png;
}

function writeIco(filePath, png256) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type
  header.writeUInt16LE(1, 4); // image count

  const dir = Buffer.alloc(16);
  dir.writeUInt8(0, 0); // 0 means 256
  dir.writeUInt8(0, 1); // 0 means 256
  dir.writeUInt8(0, 2); // palette
  dir.writeUInt8(0, 3); // reserved
  dir.writeUInt16LE(1, 4); // color planes
  dir.writeUInt16LE(32, 6); // bpp
  dir.writeUInt32LE(png256.length, 8); // data size
  dir.writeUInt32LE(22, 12); // data offset

  fs.writeFileSync(filePath, Buffer.concat([header, dir, png256]));
}

function maybeBuildIcns() {
  try {
    execFileSync('iconutil', ['-c', 'icns', ICONSET_DIR, '-o', path.join(BUILD_DIR, 'icon.icns')], { stdio: 'ignore' });
  } catch (error) {
    console.warn('iconutil not available, skipped icon.icns generation');
  }
}

function main() {
  ensureDir(BUILD_DIR);
  ensureDir(ICONSET_DIR);

  const icon1024 = writePngFile(path.join(BUILD_DIR, 'icon.png'), 1024);
  const icon256 = writePngFile(path.join(BUILD_DIR, 'icon-256.png'), 256);

  const iconsetEntries = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024],
  ];

  for (const [name, size] of iconsetEntries) {
    writePngFile(path.join(ICONSET_DIR, name), size);
  }

  writeIco(path.join(BUILD_DIR, 'icon.ico'), icon256);
  maybeBuildIcns();

  // keep icon1024 referenced so lint won't complain in stricter setups
  if (!icon1024 || icon1024.length === 0) {
    throw new Error('Failed to generate icon.png');
  }
}

main();
