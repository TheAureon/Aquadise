// Base aquarium decorations: always available, unlimited. Harvested plants are added on top.
// kind: floor (sits on the sand) | float (hangs at the water top)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.decorations = [
  { id: 'pebble_rock', name: 'Rock', kind: 'floor', sprite_size: 'small', color: '#8c8178', art: { shape: 'rock', seed: 2 } },
  { id: 'boulder', name: 'Boulder', kind: 'floor', sprite_size: 'medium', color: '#76706a', art: { shape: 'rock', seed: 5 } },
  { id: 'seashell', name: 'Seashell', kind: 'floor', sprite_size: 'tiny', color: '#f2d9c4', art: { shape: 'shell' } },
  { id: 'starfish', name: 'Starfish', kind: 'floor', sprite_size: 'tiny', color: '#f08a3c', accent: '#ffd27a', art: { shape: 'starfish' } },
  { id: 'driftwood', name: 'Driftwood', kind: 'floor', sprite_size: 'wide', color: '#8a6a4a', art: { shape: 'driftwood' } },
  { id: 'amphora', name: 'Amphora', kind: 'floor', sprite_size: 'small', color: '#c4703a', accent: '#f2c14e', art: { shape: 'amphora' } },
  { id: 'castle', name: 'Sand Castle', kind: 'floor', sprite_size: 'large', color: '#d9c49a', art: { shape: 'castle' } },
  { id: 'arch', name: 'Stone Arch', kind: 'floor', sprite_size: 'large', color: '#8a8478', art: { shape: 'arch' } },
  { id: 'treasure', name: 'Treasure Chest', kind: 'floor', sprite_size: 'small', color: '#9b5a2e', art: { shape: 'treasure' } },
  { id: 'pillar', name: 'Ruined Pillar', kind: 'floor', sprite_size: 'tall', color: '#c9c4b8', art: { shape: 'pillar' } },
  { id: 'anchor', name: 'Anchor', kind: 'floor', sprite_size: 'medium', color: '#6a6460', art: { shape: 'anchor' } },
  { id: 'barrel', name: 'Old Barrel', kind: 'floor', sprite_size: 'small', color: '#8a5b33', art: { shape: 'barrel' } },
  { id: 'bubbler', name: 'Bubbler', kind: 'floor', sprite_size: 'tiny', color: '#9aa4ae', art: { shape: 'bubbler' }, bubbles: true }
];
