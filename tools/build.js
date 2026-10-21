// Packs the whole game into ONE file for uploading (itch.io, a website, a USB stick...):
//   node tools/build.js
// It writes build/Aquadise/index.html (the style sheet, every script, the sprites and the recordings all
// inside it) and build/Aquadise.zip (that one file, ready to upload as an HTML5 game). Nothing else is
// needed: the page works from any web host and straight from disk (file://).
// It reads index.html, so a new <script> added there is packed automatically. Before packing it refreshes
// the embedded sprites and recordings (tools/embed-sprites.js, tools/embed-audio.js), so they match the
// files in assets/. The build/ folder is not kept in git.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'Aquadise');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 1. fresh embedded copies of the art and the recordings
require('./embed-sprites.js')();
execFileSync(process.execPath, [path.join(__dirname, 'embed-audio.js')], { stdio: 'ignore' });

// 2. inline everything index.html links to
let html = read('index.html'), scripts = 0;
const inline = (code) => code.replace(/<\/(script)/gi, '<\\/$1');            // never end the <script> early
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, f) => `<style>\n${read(f)}</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, f) => { scripts++; return `<script>/* ${f} */\n${inline(read(f))}</script>`; });
// the packed page has no PNG files beside it: always use the embedded sprites (src/assets.js)
html = html.replace('<head>', '<head>\n  <script>var AQ = { packed: true };</script>');
const left = [...html.matchAll(/(?:src|href)="(?!data:|https?:|#)([^"]+)"/g)].map((m) => m[1]);
if (left.length) { console.error('Still points at outside files: ' + left.join(', ')); process.exit(1); }

fs.rmSync(path.join(ROOT, 'build'), { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// 3. the zip (written here, so no zip program is needed)
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {                                                         // files: [[name, Buffer]]
  const parts = [], dir = []; let off = 0;
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [name, data] of files) {
    const nm = Buffer.from(name), packed = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12); head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(nm.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14); cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(packed.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nm.length, 28); cen.writeUInt32LE(off, 42);
    parts.push(head, nm, packed); dir.push(cen, nm); off += 30 + nm.length + packed.length;
  }
  const size = dir.reduce((a, b) => a + b.length, 0), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, ...dir, end]);
}
const z = zip([['index.html', Buffer.from(html)]]);
fs.writeFileSync(path.join(ROOT, 'build', 'Aquadise.zip'), z);

const kb = (n) => Math.round(n / 1024) + ' KB';
console.log(`Packed ${scripts} scripts, the style sheet, the sprites and the recordings into ONE file:`);
console.log(`  build/Aquadise/index.html  ${kb(Buffer.byteLength(html))}`);
console.log(`  build/Aquadise.zip         ${kb(z.length)}  (upload this one)`);
