// The weather (src/weather.js). Each sea region that reaches the surface has its own weather, which
// changes slowly over real time. Names: weather.<kind> in data/lang/en.js.
//
// kinds: how each weather looks, as strengths 0-1:
//   cloud  clouds over the sky (and a greyer sky)     wave  bigger waves, whitecaps (from 0.5)
//   rain   rain streaks and rings on the surface      fog   a veil over the sky and the sea
//   dark   the sunlit sea gets this much darker        wind  how much the rain slants and clouds drift
//   storm  lightning (a soft distant glow with REDUCE FLASHING)
// regions: how likely each weather is there (bigger = more often). A storm only rages at night: by day
// the same stretch of weather is rain, and it builds at dusk.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.weather = {
  kinds: {
    calm:   { cloud: 0.05, wave: 0,    rain: 0,    fog: 0,    dark: 0,    wind: 0.1,  storm: 0 },
    breezy: { cloud: 0.3,  wave: 0.35, rain: 0,    fog: 0,    dark: 0,    wind: 0.5,  storm: 0 },
    choppy: { cloud: 0.5,  wave: 0.75, rain: 0,    fog: 0,    dark: 0.04, wind: 0.8,  storm: 0 },
    rain:   { cloud: 0.85, wave: 0.4,  rain: 0.65, fog: 0.1,  dark: 0.12, wind: 0.35, storm: 0 },
    fog:    { cloud: 0.5,  wave: 0.1,  rain: 0,    fog: 0.85, dark: 0.06, wind: 0.05, storm: 0 },
    storm:  { cloud: 1,    wave: 1,    rain: 1,    fog: 0.15, dark: 0.3,  wind: 1,    storm: 1 }
  },
  order: ['calm', 'breezy', 'choppy', 'rain', 'fog', 'storm'],
  regions: {
    tide_pools: { calm: 4, breezy: 3, choppy: 1, rain: 2, fog: 2, storm: 0.4 },
    coral:      { calm: 5, breezy: 3, choppy: 1, rain: 2, fog: 1, storm: 0.3 },
    ruins:      { calm: 3, breezy: 3, choppy: 2, rain: 2, fog: 2, storm: 0.4 },
    open_ocean: { calm: 2, breezy: 3, choppy: 3, rain: 2, fog: 1, storm: 0.8 },
    kelp:       { calm: 3, breezy: 3, choppy: 2, rain: 3, fog: 2, storm: 0.4 },
    mangrove:   { calm: 3, breezy: 2, choppy: 1, rain: 4, fog: 3, storm: 0.5 },
    ice:        { calm: 3, breezy: 3, choppy: 1, rain: 1, fog: 4, storm: 0.3 }
  },
  hill: 'tide_pools'          // the hill shares this region's weather (it overlooks the tide pools)
};
