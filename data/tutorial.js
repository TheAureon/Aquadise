// Tutorial text: the help line, one-time tips (src/tips.js), the guided first dive and the Guide.
// Edit freely - no code changes needed. Write key names as {k:action} (e.g. {k:sneak}); they're filled
// in from the real key bindings (AQ.TUNING.keys in config.js, see src/keys.js), so they stay correct if
// the controls change. Actions: move left right up down jump sneak net bait log map help pause interact
// mute photo stationView feed tanks undo flip layer prevTank nextTank photoSnap photoFreeze photoIcons
// photoFrame photoCaption guide. Guide pages can also show config numbers: {c:clock.dayMinutes} (any
// AQ.TUNING path) and {inv:breeding.variantChance} (1 / that value, rounded: "1 in 25").
//
// A tip:   id      unique name (saved once seen)
//          on      game events that show it (fired by the game, see src/tips.js for the list)
//          where   'play' (out in the world: sea, hill, building) | 'tank' (the tank screen) | 'any' (either)
//          needs   optional module the feature needs (e.g. 'Starfall'): skipped if the build doesn't have it
//          known   things that prove a returning player already knows it (older saves skip those tips):
//                  caughtAny chest deep night bottle star station tank tankstar pair bred bumped
//          icon    optional: a sprite key ('chest', 'misc.bottle', 'creature.<id>'...) or 'ui:<n>' for
//                  the small UI icons (0 alert, 1 moon, 2 star, 3 heart, 4 book, 5 sneak, 6 sparkle)
//          lines   1-3 short lines (they wrap to the box)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.tutorial = {
  // the controls hint at the bottom of the screen (first moments, or press {k:help})
  helpLines: [
    'MOVE {k:move}  JUMP {k:jump}  SNEAK {k:sneak}  NET {k:net} (HOLD TO PRY)',
    'BAIT {k:bait}  INTERACT {k:interact}  LOG {k:log}  MAP {k:map}  GUIDE {k:guide}  MUTE {k:mute}'
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
      { id: 'done', text: 'That\'s the basics! The GUIDE ({k:guide}, or the pause menu) has more, whenever you like.' }
    ],
    nice: ['NICE!', 'LOVELY!', 'GOT IT!', 'WELL DONE!']
  },

  // The GUIDE: a paged field-guide book (src/guide.js). Each page: title, an icon (a sprite key or 'ui:<n>'),
  // optional `needs` (a module the feature needs; the page is left out without it), optional `scale`
  // (force the picture's size) and 4-6 short lines.
  // A line can be { text, needs } to appear only when that feature exists. Lines wrap to the page.
  guide: [
    { title: 'Moving, swimming and sneaking', icon: 'player', scale: 2, lines: [
      'Walk and swim with {k:move} (or {k:arrows}). {k:jump} jumps on land.',
      'In deep water you swim freely; shallow puddles you just splash through.',
      'Hold {k:sneak} to sneak: slower, and much quieter.',
      'Creatures notice how close you come and how fast, so sneaking helps.',
      'In the aquarium building, ladders climb with {k:up} and {k:down}.'] },
    { title: 'Catching', icon: 'creature.glasswinged_minnow', lines: [
      'Swing the net with {k:net}. Keep holding after a swing to pry a creature loose.',
      'Bait ({k:bait}, underwater) drifts down and draws curious creatures out.',
      'Each species has its own way: wary ones need sneaking, darters stop to rest,',
      'hiders blend in until they move, some only show at the right moment,',
      'curious ones come to look at you, and shy ones peek out if you wait quietly.',
      'Some need a bigger net. The log has a hint for every species.'] },
    { title: 'Upgrades and chests', icon: 'chest', needs: 'Chests', lines: [
      'Chests turn up on the seabed now and then. Each holds an upgrade:',
      'NET: a bigger net that reaches further, for stronger creatures too.',
      'SPEED: faster swimming. LAMP: more light around you in the dark.',
      'DEEP: dive deeper. Past your depth the water just turns heavy:',
      'nothing is ever hurt, you simply drift back up.'] },
    { title: 'Day and night', icon: 'ui:1', lines: [
      'A whole day passes in about {c:clock.dayMinutes} real minutes. The HUD shows the sun or moon.',
      'Some creatures only come out at night, and glowing ones are easier to spot.',
      'Night-blooming plants only open (and can be harvested) after dark.',
      { needs: 'Starfall', text: 'Some nights a star falls into the sea: rare creatures wait where it lands,' },
      { needs: 'Starfall', text: 'but only for a few minutes. Meteor showers bring several. Follow the light.' }] },
    { title: 'Getting to the aquarium', icon: 'misc.ufo', lines: [
      'Walk off the left edge of the Tide Pools and up the hill.',
      'A UFO hovers at the top: stand in its beam and press {k:interact}.',
      'It lifts you to your aquarium building, floating in space.',
      'The DIRECTORY shows every tank. {k:stationView} shows the whole building.',
      'Press {k:interact} at a tank to tend it. The beam pad takes you back to the hill.'] },
    { title: 'Tanks', icon: 'decor.castle', lines: [
      'Every catch goes to its biome\'s tank (hunters and star creatures have their own).',
      'Drag decor and plants from the tray into the tank. {k:feed} feeds everyone.',
      'Creatures have LIKES: give them those and they visit and grow happy.',
      'The stars show the tank\'s vibe: hover them to see what helps.',
      'New star levels unlock new themed decorations.'] },
    { title: 'Sexes, breeding and rare colors', icon: 'ui:3', needs: 'Breeding', lines: [
      'Most animals are ♂ or ♀; the log shows which ones you have caught.',
      'A ♂ and a ♀ in a happy ({c:breeding.minStars}+ stars), fed tank may court.',
      'Then an egg or a baby arrives (mammals have live babies).',
      'Babies grow up in about {c:breeding.growMinutes} minutes.',
      'About 1 in {inv:breeding.variantChance} babies is a rare color (✦). It\'s all just for fun.'] },
    { title: 'The log', icon: 'ui:4', lines: [
      '{k:log} opens your collection log.',
      'SPECIES: every species by biome, with a hint for each.',
      'VARIANTS: the rare colors you have bred.',
      { needs: 'Bottles', text: 'NOTES: field notes from message bottles. There is one bottle per species,' },
      { needs: 'Bottles', text: 'always somewhere you can reach. Swim into one to pick it up.' }] },
    { title: 'Photo mode', icon: 'ui:6', lines: [
      'In a tank, press {k:photo} (or PHOTO) to take a picture.',
      '{k:photoSnap} or a click snaps it; it saves as a PNG download.',
      '{k:photoFreeze} freezes the moment, {k:photoIcons} hides the hearts and mood icons,',
      '{k:photoFrame} picks a frame (none, border, polaroid), {k:photoCaption} adds a caption.',
      '{k:photo} or ESC leaves photo mode.'] },
    { title: 'Sound and settings', icon: 'ui:5', lines: [
      'Pause ({k:pause}) > SOUND: music and effects volume, mute and a SOUND TEST.',
      '{k:mute} mutes or unmutes anywhere.',
      'HINTS turns the tips on or off; RESET TIPS shows them all again.',
      'REDUCE FLASHING softens the camera flash, falling stars and blinking lights.',
      'Pause > TUTORIAL starts the guided dive again any time. Progress saves by itself.'] }
  ],

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
    { id: 'flashing', on: ['flash'], where: 'any', icon: 'ui:6', lines: [
      'Bright flashes or blinking lights bothering you?',
      'Turn on REDUCE FLASHING in Pause > SOUND (or on the title).'] },
    { id: 'bumped', on: ['bumped'], where: 'play', known: ['bumped'], icon: 'ui:0', lines: [
      'Just a bump! Nothing in the sea can hurt you.',
      'Some creatures only nudge you back a little.'] }
  ]
};
