#!/usr/bin/env node
// Generates placeholder sprite sheets (PNG) + assets/manifest.js from the data files.
//   node tools/gen-placeholders.js           -> write missing PNGs, rebuild manifest
//   node tools/gen-placeholders.js --force   -> overwrite ALL placeholder PNGs (careful: replaces real art)
// Manifest entries marked `custom: true` are preserved as-is.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { encodePNG } = require('./png');

const ROOT = path.join(__dirname, '..');
const FORCE = process.argv.includes('--force');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
const load = (rel) => { const f = path.join(ROOT, rel); if (fs.existsSync(f)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: rel }); };
['data/sprite-spec.js', 'data/creatures.js', 'data/decorations.js', 'assets/manifest.js'].forEach(load);
const PH = require(path.join(ROOT, 'src/placeholder-art.js'));
const AQ = ctx.AQ;
const spec = AQ.data.spriteSpec;
const oldManifest = (AQ.manifest && AQ.manifest.sprites) || {};

const sprites = {};
function anchorFor(kind, fw, fh) {
  const a = spec.anchors[kind];
  if (a === 'bottom') return [Math.floor(fw / 2), fh - 1];
  if (a === 'top') return [Math.floor(fw / 2), 0];
  if (a === 'topleft') return [0, 0];
  return [Math.floor(fw / 2), Math.floor(fh / 2)];
}
function add(key, file, kind, size, art) {
  const [fw, fh] = Array.isArray(size) ? size : spec.sizes[size];
  if (oldManifest[key] && oldManifest[key].custom) { sprites[key] = oldManifest[key]; return; }
  const entry = { file, fw, fh, anchor: anchorFor(kind, fw, fh), anims: JSON.parse(JSON.stringify(spec.anims[kind])) };
  sprites[key] = entry;
  const out = path.join(ROOT, 'assets', file);
  const pix = PH.buildSheet(Object.assign({}, entry, { art }));
  // visible bounds [x0, y0, x1, y1] of the art inside a frame (union of all frames): the game uses
  // this to stand crawlers exactly on the ground instead of guessing from the frame size.
  let b = [fw, fh, -1, -1];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) if (pix.d[(y * pix.w + x) * 4 + 3]) {
    const fx = x % fw, fy = y % fh; b = [Math.min(b[0], fx), Math.min(b[1], fy), Math.max(b[2], fx), Math.max(b[3], fy)];
  }
  entry.vis = b;
  if (!FORCE && fs.existsSync(out)) return;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePNG(pix.w, pix.h, pix.d));
}

add('player', 'sprites/misc/player.png', 'player', [28, 40], { shape: 'diver', fit: false });
add('chest', 'sprites/misc/chest.png', 'chest', 'small', { shape: 'chest' });
add('bait', 'sprites/misc/bait.png', 'bait', [8, 8], { shape: 'bait' });

// scene pieces: the path to the hill, the hill, the UFO + beam, and the aquarium building in space
add('misc.signpost', 'sprites/scene/signpost.png', 'prop', [16, 24], { shape: 'signpost' });
add('misc.ufo', 'sprites/scene/ufo.png', 'ufo', [64, 32], { shape: 'ufo' });
add('misc.beam', 'sprites/scene/beam.png', 'beam', [32, 96], { shape: 'beam', fit: false });
add('ui.marker', 'sprites/ui/marker.png', 'uimarker', [16, 16], { shape: 'uimarker', fit: false });
add('ui.arrow', 'sprites/ui/arrow.png', 'uimarker', [8, 8], { shape: 'uiarrow', fit: false });
add('ui.icons', 'sprites/ui/icons.png', 'uiicons', [12, 12], { shape: 'uiicons', fit: false });
add('ui.touch', 'sprites/ui/touch.png', 'uitouch', [16, 16], { shape: 'uitouch', fit: false });
add('ui.stick', 'sprites/ui/stick.png', 'uistick', [32, 32], { shape: 'uistick', fit: false });
add('ui.gradcap', 'sprites/ui/gradcap.png', 'uigradcap', [8, 8], { shape: 'uigradcap', fit: false });
add('ui.pane', 'sprites/ui/pane.png', 'uipane', [8, 8], { shape: 'uipane', fit: false });
add('misc.bottle', 'sprites/scene/bottle.png', 'bottle', [12, 14], { shape: 'bottle', fit: false });
add('misc.beampad', 'sprites/scene/beampad.png', 'propanim', [40, 12], { shape: 'beampad' });
add('misc.console', 'sprites/scene/console.png', 'propanim', [20, 28], { shape: 'console' });
add('misc.tank_frame', 'sprites/scene/tank_frame.png', 'prop', [64, 44], { shape: 'tankframe', fit: false });
add('bg.hill_sky', 'sprites/scene/hill_sky.png', 'still', [320, 180], { shape: 'hillsky', fit: false });
add('bg.space', 'sprites/scene/space.png', 'still', [320, 180], { shape: 'spacebg', fit: false });
add('bg.planet_ringed', 'sprites/scene/planet_ringed.png', 'still', [56, 32], { shape: 'planet', ring: true, color: '#e8a86a', accent: '#f2d9a0' });
add('bg.planet_small', 'sprites/scene/planet_small.png', 'still', [20, 20], { shape: 'planet', color: '#7fb0e8', accent: '#cfe8ff' });
add('tile.hill', 'sprites/scene/tile_hill.png', 'still', [32, 48], { shape: 'hilltile', fit: false });
add('tile.station_wall', 'sprites/scene/tile_station_wall.png', 'still', [32, 32], { shape: 'stationwall', fit: false });
add('tile.station_floor', 'sprites/scene/tile_station_floor.png', 'still', [32, 8], { shape: 'stationfloor', fit: false });
add('tile.station_hull', 'sprites/scene/tile_station_hull.png', 'still', [32, 32], { shape: 'stationhull', fit: false });
add('tile.ladder', 'sprites/scene/tile_ladder.png', 'still', [16, 8], { shape: 'laddertile', fit: false });

for (const c of AQ.data.creatures || []) {
  const kind = c.is_plant ? 'plant' : 'creature';
  const folder = c.is_plant ? 'plants' : 'creatures';
  add(`${kind}.${c.id}`, `sprites/${folder}/${c.id}.png`, kind, c.sprite_size, Object.assign({ shape: c.art.shape, color: c.color, accent: c.accent }, c.art));
  // male variant (the base sheet doubles as the female): same art + a small crest
  // rare colour variant (only bred babies can be one): hue-shifted copies of the adult, male and baby sheets
  if (!c.is_plant) {
    let h = 0; for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const hue = 100 + (h % 160);                                   // 100..260 degrees: clearly different
    // a family can give its rare variant a pattern instead (AQ.data.families[...].variantArt), so it
    // never looks like one of the family's natural colours
    const famArt = c.family && AQ.data.families && AQ.data.families[c.family] && AQ.data.families[c.family].variantArt;
    const base = famArt ? Object.assign({ shape: c.art.shape }, c.art, famArt) : Object.assign({ shape: c.art.shape, color: c.color, accent: c.accent }, c.art, { hue });
    add(`${kind}.${c.id}.v`, `sprites/${folder}/${c.id}_v.png`, kind, c.sprite_size, base);
    if (c.sexes !== 'none') add(`${kind}.${c.id}.v.m`, `sprites/${folder}/${c.id}_v_m.png`, kind, c.sprite_size, Object.assign({}, base, { male: true }));
    add(`${kind}.${c.id}.baby.v`, `sprites/${folder}/${c.id}_baby_v.png`, kind, c.sprite_size, Object.assign({}, base, { baby: true }));
  }
  // night-blooming plants also get a closed-bud sheet for the daytime
  if (c.is_plant && c.bloom) add(`${kind}.${c.id}.closed`, `sprites/${folder}/${c.id}_closed.png`, kind, c.sprite_size, Object.assign({ shape: c.art.shape, color: c.color, accent: c.accent, closed: true }, c.art));
  // juvenile (born in the tanks): the same art drawn ~60% size and lighter, same frame + anchor
  if (!c.is_plant) add(`${kind}.${c.id}.baby`, `sprites/${folder}/${c.id}_baby.png`, kind, c.sprite_size, Object.assign({ shape: c.art.shape, color: c.color, accent: c.accent, baby: true }, c.art));
  if (!c.is_plant && c.sexes !== 'none') add(`${kind}.${c.id}.m`, `sprites/${folder}/${c.id}_m.png`, kind, c.sprite_size, Object.assign({ shape: c.art.shape, color: c.color, accent: c.accent, male: true }, c.art));
}
for (const d of AQ.data.decorations || []) {
  add(`decor.${d.id}`, `sprites/decor/${d.id}.png`, 'decor', d.sprite_size, Object.assign({ color: d.color, accent: d.accent }, d.art));
}

const header = '// AUTO-GENERATED by tools/gen-placeholders.js. Swap PNGs freely; set `custom: true` on an entry to stop the\n' +
  '// generator from touching it (e.g. if your real sheet uses different frame sizes/counts).\n' +
  'var AQ = (typeof AQ !== \'undefined\') ? AQ : {};\n';
fs.writeFileSync(path.join(ROOT, 'assets/manifest.js'), header + 'AQ.manifest = ' + JSON.stringify({ sprites }, null, 1) + ';\n');
console.log(`manifest: ${Object.keys(sprites).length} sprites${FORCE ? ' (forced regen)' : ''}`);
// keep the file:// copy of the sprites in sync (see tools/embed-sprites.js)
console.log(`embedded ${require('./embed-sprites')()} sprites for file:// use`);
