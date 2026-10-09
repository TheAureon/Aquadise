// Tutorial structure: the help line, the CONTROLS panel, one-time tips (src/tips.js), the guided first
// dive (src/dive.js) and the Guide (src/guide.js). The TEXT is in the language files (data/lang/en.js):
//   help.<n>, help.touch.<n>        the controls hint at the bottom of the screen (keyboard / touch)
//   controls.<n>, controls.<n>.keys the CONTROLS panel on the title screen (action, keys)
//   tip.<id>                        a tip's text (it wraps to the box)
//   dive.prompt.*, dive.step.<id>, dive.nice.<n>   the guided dive
//   guide.<id>.title, guide.<id>.<n>               a Guide page and its lines
// Write key names as {k:action} (e.g. {k:sneak}); they're filled in from the real key bindings
// (AQ.TUNING.keys in config.js, see src/keys.js), so they stay correct if the controls change. Actions:
// move left right up down jump sneak net bait log map help pause interact mute photo stationView feed
// tanks undo flip layer scrollLeft scrollRight prevTank nextTank photoSnap photoFreeze photoIcons photoFrame photoCaption guide.
// Guide pages can also show config numbers: {c:clock.dayMinutes} (any AQ.TUNING path) and
// {inv:breeding.variantChance} (1 / that value, rounded: "1 in 25").
//
// A tip:   id      unique name (saved once seen; its text is tip.<id>)
//          on      game events that show it (fired by the game, see src/tips.js for the list)
//          where   'play' (out in the world: sea, hill, building) | 'tank' (the tank screen) | 'any' (either)
//          needs   optional module the feature needs (e.g. 'Starfall'): skipped if the build doesn't have it
//          known   things that prove a returning player already knows it (older saves skip those tips):
//                  caughtAny chest deep night bottle star station tank tankstar pair bred bumped graduated panes
//          icon    optional: a sprite key ('chest', 'misc.bottle', 'creature.<id>'...) or 'ui:<n>' for
//                  the small UI icons (0 alert, 1 moon, 2 star, 3 heart, 4 book, 5 sneak, 6 sparkle)
// A Guide page: id (its text is guide.<id>.*), icon (a sprite key or 'ui:<n>'), optional `needs` (a
// module the feature needs; the page is left out without it), optional `scale` (the picture's size),
// lines (how many), optional lineNeeds { <line number>: module } for lines shown only with that feature.
// The text getters (title, lines...) are added by src/langdata.js.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.tutorial = {
  helpLines: 2, touchHelpLines: 2, controls: 9,
  nudges: { spam: 12, drought: 12, mash: 12 },   // friendly nudges: how many lines of each kind (nudge.<kind>.<n>, src/nudges.js)
  dive: { prompt: { lines: 2 }, steps: ['move', 'jump', 'swim', 'sneak', 'net', 'catch', 'bait', 'log', 'done'], nice: 4 },
  guide: [
    { id: 'moving', icon: 'player', scale: 2, lines: 5 },
    { id: 'catching', icon: 'creature.glasswinged_minnow', lines: 6 },
    { id: 'chests', icon: 'chest', needs: 'Chests', lines: 6, lineNeeds: { 6: 'Panes' } },
    { id: 'daynight', icon: 'ui:1', lines: 5, lineNeeds: { 4: 'Starfall', 5: 'Starfall' } },
    { id: 'aquarium', icon: 'misc.ufo', lines: 5 },
    { id: 'tanks', icon: 'decor.castle', lines: 9, lineNeeds: { 6: 'Panes', 8: 'Pairs', 9: 'Release' } },
    { id: 'breeding', icon: 'ui:3', needs: 'Breeding', lines: 8 },
    { id: 'log', icon: 'ui:4', lines: 5, lineNeeds: { 4: 'Bottles', 5: 'Bottles' } },
    { id: 'photo', icon: 'ui:6', lines: 5 },
    { id: 'settings', icon: 'ui:5', lines: 6 }
  ],
  tips: [
    { id: 'noticed', on: ['noticed'], where: 'play', known: ['caughtAny'], icon: 'ui:0' },
    { id: 'bait', on: ['bait'], where: 'play', known: ['caughtAny'], icon: 'bait' },
    { id: 'catch', on: ['catch'], where: 'play', known: ['caughtAny'], icon: 'ui:2' },
    { id: 'log', on: ['logClosed'], where: 'play', known: ['caughtAny'], icon: 'ui:4' },
    { id: 'chest', on: ['chest'], where: 'play', needs: 'Chests', known: ['chest'], icon: 'chest' },
    { id: 'deep', on: ['heavy'], where: 'play', known: ['deep'], icon: 'ui:5' },
    { id: 'night', on: ['evening'], where: 'play', known: ['night'], icon: 'ui:1' },
    { id: 'bottle', on: ['bottle'], where: 'play', needs: 'Bottles', known: ['bottle'], icon: 'misc.bottle' },
    { id: 'star', on: ['starfall', 'shower'], where: 'play', needs: 'Starfall', known: ['star'], icon: 'ui:6' },
    { id: 'ufo', on: ['ufo'], where: 'play', known: ['station'], icon: 'misc.ufo' },
    { id: 'station', on: ['station'], where: 'play', known: ['station'], icon: 'ui:4' },
    { id: 'tank', on: ['tank'], where: 'tank', known: ['tank'], icon: 'ui:3' },
    { id: 'tankstar', on: ['tankstar', 'unlock'], where: 'tank', known: ['tankstar'], icon: 'ui:2' },
    { id: 'pair', on: ['pair'], where: 'any', needs: 'Breeding', known: ['pair'], icon: 'ui:3' },
    { id: 'court', on: ['court'], where: 'any', needs: 'Breeding', known: ['bred'], icon: 'ui:3' },
    { id: 'baby', on: ['baby'], where: 'any', needs: 'Breeding', known: ['bred'], icon: 'ui:3' },
    { id: 'nursery', on: ['nursery'], where: 'tank', needs: 'Nursery', known: ['graduated'], icon: 'ui:3' },
    { id: 'flashing', on: ['flash'], where: 'any', icon: 'ui:6' },
    { id: 'bumped', on: ['bumped'], where: 'play', known: ['bumped'], icon: 'ui:0' },
    { id: 'panes', on: ['panes'], where: 'any', needs: 'Panes', known: ['panes'], icon: 'ui.pane' },
    { id: 'wideTank', on: ['wideTank'], where: 'tank', icon: 'ui.pane' },
    { id: 'tankTab', on: ['tankTab'], where: 'tank', icon: 'ui:3' }
  ]
};
