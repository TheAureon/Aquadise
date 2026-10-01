// Per-biome aquarium tank looks. Every field is optional; missing ones fall back to `default`.
// top/deep:  water gradient colours (top of tank -> sand)
// shafts:    strength of the swaying light shafts from the lid (0 = none)
// caustics:  strength of the light ripples on the sand
// dark:      how dark the tank is (0..1). In dark tanks, decor with a `glow` colour lights it up.
// particles: motes | snow (slow falling flakes) | embers (warm rising sparks) | fireflies | spores
// lamp:      colour of the LED strip in the lid
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.tankStyles = {
  default:    { shafts: 0.05, caustics: 0.22, dark: 0, particles: 'motes', lamp: '#9feff0' },
  tide_pools: { top: '#c4f2ee', deep: '#3a9fb8', shafts: 0.07, caustics: 0.3, lamp: '#fff3c4' },
  kelp:       { top: '#a8e2c4', deep: '#1d5b55', shafts: 0.08, caustics: 0.2, particles: 'spores', lamp: '#c8f0a0' },
  coral:      { top: '#b0f2f6', deep: '#2a7fb8', shafts: 0.08, caustics: 0.3, lamp: '#ffd0e0' },
  trench:     { top: '#2a4470', deep: '#050b1e', shafts: 0, caustics: 0, dark: 0.5, particles: 'snow', lamp: '#5f7fff' },
  cave:       { top: '#3e5a6a', deep: '#0e1a24', shafts: 0.02, caustics: 0.04, dark: 0.38, particles: 'motes', lamp: '#9fb8c8' },
  open_ocean: { top: '#94dcf6', deep: '#1846a0', shafts: 0.1, caustics: 0.26, lamp: '#bff6ff' },
  ruins:      { top: '#8cc4b8', deep: '#1a3a48', shafts: 0.06, caustics: 0.18, dark: 0.12, lamp: '#ffe9a8' },
  vents:      { top: '#6a4048', deep: '#1a0a10', shafts: 0, caustics: 0.05, dark: 0.32, particles: 'embers', lamp: '#ff9a5a' },
  mangrove:   { top: '#b4cc8a', deep: '#33452a', shafts: 0.07, caustics: 0.14, dark: 0.05, particles: 'spores', lamp: '#e8f0a0' },
  ice:        { top: '#eefcff', deep: '#4f9ccc', shafts: 0.11, caustics: 0.32, particles: 'snow', lamp: '#ffffff' },
  lush_cave:  { top: '#5a7a6a', deep: '#141e2a', shafts: 0.03, caustics: 0.06, dark: 0.32, particles: 'fireflies', lamp: '#ffc0f0' }
};
