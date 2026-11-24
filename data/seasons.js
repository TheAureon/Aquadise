// The seasons (src/seasons.js): how each one changes how the places look. Names: season.<id> in
// data/lang/en.js. Lengths and timing: AQ.TUNING.seasons.
//
//   sky      the sky's colours lean toward these [top, horizon], by `k` (0-1)
//   water    a soft tint over the sunlit water, per region ('all' = everywhere else): [r, g, b, strength]
//   plants   the plants' colours per region and kind (the terrain is redrawn when the season turns; each plant
//            stays exactly where it is, only its colours change). A front-layer kelp uses a darker version.
//   hill     the hill: grass colour over the tile [r, g, b, strength], snow on the ground, flowers, the far hills
//   drift    small things in the world: 'spawn' (coral spawn rising off the reef), 'leaves' (falling on the
//            hill), 'snow' (over the ice and on the hill), 'floes' (ice floes past the ice shelf)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.seasons = {
  order: ['spring', 'summer', 'autumn', 'winter'],
  looks: {
    spring: {
      sky: { top: [96, 190, 228], bottom: [214, 244, 232], k: 0.3 },
      water: { tide_pools: [70, 210, 140, 0.16], coral: [80, 220, 150, 0.15], ruins: [80, 200, 150, 0.08], all: [90, 210, 190, 0.05] },
      plants: {
        coral: { coral: ['#ff9a8a', '#ffc070', '#e0a8ff', '#7fe8d4', '#ffb8d8'], seagrass: ['#58c070', '#45a05a', '#7ee08e'] },
        kelp: { kelp: ['#7aa83a', '#5f8a2c', '#9ccc4a'], seagrass: ['#58c070', '#45a05a', '#7ee08e'] },
        tide_pools: { seagrass: ['#58c070', '#45a05a', '#7ee08e'] },
        open_ocean: { seagrass: ['#58c070', '#45a05a', '#7ee08e'] }
      },
      hill: { grass: [120, 210, 90, 0.18], flowers: 70 },
      drift: ['spawn']
    },
    summer: {
      sky: { top: [70, 160, 230], bottom: [200, 236, 246], k: 0.35 },
      water: { all: [120, 240, 255, 0.09] },
      plants: {},
      hill: { grass: [150, 200, 70, 0.1], flowers: 40 },
      drift: []
    },
    autumn: {
      sky: { top: [120, 160, 200], bottom: [244, 214, 180], k: 0.35 },
      water: { kelp: [230, 170, 60, 0.14], mangrove: [210, 160, 70, 0.1], all: [230, 180, 120, 0.06] },
      plants: {
        kelp: { kelp: ['#b8902c', '#94701f', '#d8b44a'], seagrass: ['#a89a48', '#8a7c38', '#c4b45a'] },
        coral: { coral: ['#e87858', '#e8a040', '#c08ad0', '#58b8a8'], seagrass: ['#a89a48', '#8a7c38', '#c4b45a'] },
        tide_pools: { seagrass: ['#a89a48', '#8a7c38', '#c4b45a'] },
        open_ocean: { seagrass: ['#a89a48', '#8a7c38', '#c4b45a'] }
      },
      hill: { grass: [210, 160, 60, 0.42], flowers: 8, hills: [176, 150, 120] },
      drift: ['leaves']
    },
    winter: {
      sky: { top: [150, 176, 204], bottom: [226, 234, 242], k: 0.45 },
      water: { all: [190, 215, 245, 0.15], ice: [215, 232, 252, 0.16] },
      plants: {
        kelp: { kelp: ['#4f6a2a', '#3f5522', '#62803a'], seagrass: ['#6a8a78', '#566f62', '#86a694'] },
        coral: { coral: ['#d89a90', '#d8b088', '#b8a0c8', '#8ac0b8'], seagrass: ['#6a8a78', '#566f62', '#86a694'] },
        tide_pools: { seagrass: ['#6a8a78', '#566f62', '#86a694'] },
        open_ocean: { seagrass: ['#6a8a78', '#566f62', '#86a694'] }
      },
      hill: { grass: [200, 214, 220, 0.3], snow: true, flowers: 0, hills: [206, 216, 228] },
      drift: ['snow', 'floes']
    }
  },
  floes: [5180, 5700],        // winter: ice floes drift on the surface over this stretch (past the ice shelf)
  snow: [5650, 6800]          // winter: snow falls over the sea here (over the ice)
};
