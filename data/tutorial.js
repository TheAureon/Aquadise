// Tutorial text: the help line, one-time tips (src/tips.js), the guided first dive and the Guide.
// Edit freely - no code changes needed. Write key names as {k:action} (e.g. {k:sneak}); they're filled
// in from the real key bindings (AQ.TUNING.keys in config.js, see src/keys.js), so they stay correct if
// the controls change. Actions: move left right up down jump sneak net bait log map help pause interact
// mute photo stationView feed tanks undo flip layer prevTank nextTank.
//
// A tip:   id      unique name (saved once seen)
//          on      game events that show it (fired by the game, see src/tips.js for the list)
//          where   'play' (out in the world: sea, hill, building) | 'tank' (the tank screen) | 'any' (either)
//          needs   optional module the feature needs (e.g. 'Starfall'): skipped if the build doesn't have it
//          known   things that prove a returning player already knows it (older saves skip those tips):
//                  caughtAny chest deep night bottle star station tank tankstar pair bred bumped
//          icon    optional: a sprite key ('chest', 'misc.bottle', 'creature.<id>'...) or 'ui:<n>' for
//                  the small UI icons (0 alert, 1 moon, 2 star, 3 heart, 4 book, 5 sneak, 6 sparkle)
//          lines   1-3 short lines (about 46 characters each at most)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.tutorial = {
  // the controls hint at the bottom of the screen (first moments, or press {k:help})
  helpLines: [
    'MOVE {k:move}  JUMP {k:jump}  SNEAK {k:sneak}  NET {k:net} (HOLD TO PRY)',
    'BAIT {k:bait}   INTERACT {k:interact}   LOG {k:log}   MAP {k:map}   HELP {k:help}   MUTE {k:mute}'
  ],

  // The optional guided first dive (src/dive.js). Offered once on NEW GAME (a fresh save); restart it any
  // time from the pause menu (TUTORIAL). Each step completes when you actually do it; the step ids are
  // what the game checks (move jump swim sneak net catch bait log done), the text is yours to change.
  dive: {
    prompt: { title: 'Want a quick guided dive?', lines: ['A few small steps to learn the basics.', 'Skip or stop it any time.'], yes: 'YES', no: 'NO THANKS' },
    steps: [
      { id: 'move', text: 'Walk along the shore with {k:move}.' },
      { id: 'jump', text: 'Press {k:jump} to hop up onto the rocks.' },
      { id: 'swim', text: 'Wade into the deep water at the end of the shore and swim.' },
      { id: 'sneak', text: 'Hold {k:sneak} and drift close to the little minnow. Sneaking keeps it calm.' },
      { id: 'net', text: 'Swing your net with {k:net}.' },
      { id: 'catch', text: 'Now catch the minnow: aim at it and swing.' },
      { id: 'bait', text: 'Drop some bait with {k:bait}. It draws curious creatures out.' },
      { id: 'log', text: 'Open your log with {k:log} to see your catch.' },
      { id: 'done', text: 'That\'s the basics! The GUIDE in the pause menu has more, whenever you like.' }
    ],
    nice: ['NICE!', 'LOVELY!', 'GOT IT!', 'WELL DONE!']
  },

  // the CONTROLS panel on the title screen: [what, keys]
  controls: [
    ['MOVE / SWIM', '{k:move} OR {k:arrows}'], ['JUMP', '{k:jump}'], ['SNEAK', 'HOLD {k:sneak}'],
    ['NET', '{k:net}'], ['PRY', 'HOLD {k:net}'], ['BAIT', '{k:bait}'],
    ['INTERACT / LOG / MAP', '{k:interact} / {k:log} / {k:map}'], ['PAUSE', '{k:pause}'], ['MUTE SOUND', '{k:mute}']
  ],

  tips: [
    { id: 'noticed', on: ['noticed'], where: 'play', known: ['caughtAny'], icon: 'ui:0', lines: [
      'Creatures notice how close and how fast you come.',
      'Hold {k:sneak} to sneak up slowly and quietly.'] },
    { id: 'bait', on: ['bait'], where: 'play', known: ['caughtAny'], icon: 'bait', lines: [
      'Bait drifts down and draws curious creatures out.',
      'Wait nearby and let them come to you.'] },
    { id: 'catch', on: ['catch'], where: 'play', known: ['caughtAny'], icon: 'ui:2', lines: [
      'Got one! Every catch goes straight to its tank',
      'in your aquarium. The log ({k:log}) keeps track.'] },
    { id: 'log', on: ['logClosed'], where: 'play', known: ['caughtAny'], icon: 'ui:4', lines: [
      'Your log has three tabs: SPECIES, VARIANTS, NOTES.',
      'Every species has a hint on how to catch it.'] },
    { id: 'chest', on: ['chest'], where: 'play', needs: 'Chests', known: ['chest'], icon: 'chest', lines: [
      'Chests hold upgrades: NET, SPEED, LAMP and DEEP.',
      'A bigger net, faster swimming, a brighter lamp',
      'and the strength to dive deeper.'] },
    { id: 'deep', on: ['heavy'], where: 'play', known: ['deep'], icon: 'ui:5', lines: [
      'Heavy water: you are past your depth for now.',
      'Nothing is hurt. A DEEP upgrade lets you go further.'] },
    { id: 'night', on: ['evening'], where: 'play', known: ['night'], icon: 'ui:1', lines: [
      'Evening falls. Some creatures only come out at night,',
      'and glowing ones are easier to spot.',
      'A LAMP upgrade lights up more of the dark.'] },
    { id: 'bottle', on: ['bottle'], where: 'play', needs: 'Bottles', known: ['bottle'], icon: 'misc.bottle', lines: [
      'A message bottle! It holds field notes on one species.',
      'Read them in the log ({k:log}), NOTES tab.'] },
    { id: 'star', on: ['starfall', 'shower'], where: 'play', needs: 'Starfall', known: ['star'], icon: 'ui:6', lines: [
      'A falling star! Rare creatures wait where it lands,',
      'but only for a few minutes. Follow the light',
      '(the map {k:map} marks the spot).'] },
    { id: 'ufo', on: ['ufo'], where: 'play', known: ['station'], icon: 'misc.ufo', lines: [
      'This beam carries you up to your aquarium.',
      'Stand in the light and press {k:interact}.'] },
    { id: 'station', on: ['station'], where: 'play', known: ['station'], icon: 'ui:4', lines: [
      'Your aquarium! Ladders lead to every floor.',
      'The DIRECTORY lists every tank. {k:stationView} shows them all,',
      'and {k:interact} at a tank lets you tend it.'] },
    { id: 'tank', on: ['tank'], where: 'tank', known: ['tank'], icon: 'ui:3', lines: [
      'Drag decor from the tray into the tank. {k:feed} feeds.',
      'Hover the stars to see what helps the tank,',
      'and {k:photo} takes a photo.'] },
    { id: 'tankstar', on: ['tankstar', 'unlock'], where: 'tank', known: ['tankstar'], icon: 'ui:2', lines: [
      'A happier tank! Its stars show how cozy it is.',
      'New star levels unlock new decorations (marked NEW).'] },
    { id: 'pair', on: ['pair'], where: 'any', needs: 'Breeding', known: ['pair'], icon: 'ui:3', lines: [
      'A ♂ and a ♀ share a tank. In a happy, fed tank',
      'they may court and raise a family.'] },
    { id: 'court', on: ['court'], where: 'any', needs: 'Breeding', known: ['bred'], icon: 'ui:3', lines: [
      'A pair is courting! Keep their tank happy and fed,',
      'and an egg or a baby will follow.'] },
    { id: 'baby', on: ['baby'], where: 'any', needs: 'Breeding', known: ['bred'], icon: 'ui:3', lines: [
      'A baby! It grows up over time.',
      'Now and then one is born a rare color (✦).'] },
    { id: 'bumped', on: ['bumped'], where: 'play', known: ['bumped'], icon: 'ui:0', lines: [
      'Just a bump! Nothing in the sea can hurt you.',
      'Some creatures only nudge you back a little.'] }
  ]
};
