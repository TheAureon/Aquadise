// Aquarium decorations. Unlimited once available; harvested plants are added on top.
// kind:    floor (sits on the sand) | float (hangs at the water top)
// tags:    what the piece "is" - creatures' likes (data/creatures.js) refer to these tags.
//          rock shell coral kelp plant wood metal arch pillar hideout perch light ice crystal roots
//          treasure vent bubbles
// biomes:  tanks it matches for the vibe "theme" bonus (omit = fits anywhere, no bonus)
// unlock:  { biome, stars } - unlocked by reaching that many stars in that biome's tank (omit = always)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.decorations = [
  { id: 'pebble_rock', name: 'Rock', kind: 'floor', sprite_size: 'small', color: '#8c8178', art: { shape: 'rock', seed: 2 }, tags: ['rock', 'perch'] },
  { id: 'boulder', name: 'Boulder', kind: 'floor', sprite_size: 'medium', color: '#76706a', art: { shape: 'rock', seed: 5 }, tags: ['rock', 'perch'] },
  { id: 'seashell', name: 'Seashell', kind: 'floor', sprite_size: 'tiny', color: '#f2d9c4', art: { shape: 'shell' }, tags: ['shell'], biomes: ['tide_pools', 'coral'] },
  { id: 'starfish', name: 'Starfish', kind: 'floor', sprite_size: 'tiny', color: '#f08a3c', accent: '#ffd27a', art: { shape: 'starfish' }, tags: ['shell'], biomes: ['tide_pools', 'coral'] },
  { id: 'driftwood', name: 'Driftwood', kind: 'floor', sprite_size: 'wide', color: '#8a6a4a', art: { shape: 'driftwood' }, tags: ['wood', 'perch'], biomes: ['tide_pools', 'mangrove'] },
  { id: 'amphora', name: 'Amphora', kind: 'floor', sprite_size: 'small', color: '#c4703a', accent: '#f2c14e', art: { shape: 'amphora' }, tags: ['hideout', 'treasure'], biomes: ['ruins'] },
  { id: 'castle', name: 'Sand Castle', kind: 'floor', sprite_size: 'large', color: '#d9c49a', art: { shape: 'castle' }, tags: ['hideout'], biomes: ['tide_pools', 'coral'] },
  { id: 'arch', name: 'Stone Arch', kind: 'floor', sprite_size: 'large', color: '#8a8478', art: { shape: 'arch' }, tags: ['arch', 'hideout', 'rock'], biomes: ['coral', 'kelp'] },
  { id: 'treasure', name: 'Treasure Chest', kind: 'floor', sprite_size: 'small', color: '#9b5a2e', art: { shape: 'treasure' }, tags: ['treasure', 'hideout'], biomes: ['ruins'] },
  { id: 'pillar', name: 'Ruined Pillar', kind: 'floor', sprite_size: 'tall', color: '#c9c4b8', art: { shape: 'pillar' }, tags: ['pillar'], biomes: ['ruins'] },
  { id: 'anchor', name: 'Anchor', kind: 'floor', sprite_size: 'medium', color: '#6a6460', art: { shape: 'anchor' }, tags: ['metal'], biomes: ['ruins', 'open_ocean'] },
  { id: 'barrel', name: 'Old Barrel', kind: 'floor', sprite_size: 'small', color: '#8a5b33', art: { shape: 'barrel' }, tags: ['wood', 'hideout'], biomes: ['ruins'] },
  { id: 'bubbler', name: 'Bubbler', kind: 'floor', sprite_size: 'tiny', color: '#9aa4ae', art: { shape: 'bubbler' }, bubbles: true, tags: ['bubbles'] }
];
