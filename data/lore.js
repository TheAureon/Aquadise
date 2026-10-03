// Field notes: one per species, found in message bottles (src/bottles.js). A biology breakdown in a
// field researcher's voice, not catching tips (the log already has those).
//   title   an epithet          sci   an invented scientific-style name
//   lines   3-5 short lines: anatomy and what it's for, diet, habitat quirks, life cycle, an odd fact
// {name} shows as the common name once the species is caught, "this creature" until then.
// Game rules to keep: night-only creatures are out at night; mammals have live babies; other animals
// lay eggs; plants have no sex; glowing creatures glow.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.lore = {
  // ---------------------------------------------------------------- Tide Pools
  saltbloom: { title: 'The Pool-Edge Crystal', sci: 'Halanthus crystallinus', lines: [
    '{name} pulls brine up its stem and lets the sun dry it, growing petals of real salt.',
    'The crystal petals bend light down onto its roots, so it never needs deep water.',
    'It has no sexes: a petal that snaps off in a storm takes root wherever it lands.',
    'Odd fact: after a dry week the whole bloom rings faintly when the wind passes.'] },
  drift_snail: { title: 'The Patient Glider', sci: 'Lentigo vagans', lines: [
    '{name} rides on a ribbon of slime that doubles as a road home: it follows its old trails back.',
    'It grazes the green film off pool rocks with a tongue like a tiny file.',
    'Eggs are laid in clear jelly strings tucked under ledges, safe from the midday sun.',
    'Odd fact: the shimmer of its trail is the light catching sugars it leaves for its own young.'] },
  knuckle_crab: { title: 'The Clenched Shore-Keeper', sci: 'Cancer nodosus', lines: [
    '{name} has stubby, knuckled claws built for crushing, not pinching: perfect for snails.',
    'Its flat back lets it wedge sideways into crevices and lock its legs against the rock.',
    'Females carry their orange eggs tucked under the tail until the larvae swim free.',
    'Odd fact: it taps its knuckles on stone to warn rivals off its favourite crack.'] },
  glasswinged_minnow: { title: 'The Pool Sprite', sci: 'Hyalopterus minimus', lines: [
    '{name} has fins so thin they are nearly invisible, like little panes of glass.',
    'It feeds on drifting specks of plankton and is gone in a flicker when shadows pass.',
    'Each pool is a tiny kingdom: they lay sticky eggs on weed and rarely leave their pool.',
    'Odd fact: when the tide refills the pools, the youngsters ride the wash to new homes.'] },
  puddlejack: { title: 'The Pool Hopper', sci: 'Saltator stagnalis', lines: [
    '{name} has long, springy back legs for jumping from one rock pool to the next.',
    'Its skin keeps moist with a thin coat of mucus, so it can stay out of water between hops.',
    'It snaps up sand flies and pool shrimp with a quick, sticky tongue.',
    'Eggs are laid in the warmest shallow pool, where the tadpoles grow quickly.',
    'Odd fact: it judges each jump by blinking, as if measuring the distance.'] },

  // ---------------------------------------------------------------- Kelp Forest
  bladefin_perch: { title: 'The Kelp Shadows', sci: 'Perca gladiata', lines: [
    '{name} has a tall, blade-shaped back fin that sways like a kelp frond to hide the school.',
    'A school turns as one: each fish watches the stripe on the neighbour beside it.',
    'They nibble the tiny shrimp living on kelp blades.',
    'In spring they lay eggs in long ribbons wound around the kelp stalks.',
    'Odd fact: the whole school drifts in rhythm with the swell so it looks like more kelp.'] },
  kelp_otter: { title: 'The Raft Sleeper', sci: 'Lutra laminaria', lines: [
    '{name} has the densest fur in the forest: air trapped in it keeps it warm and afloat.',
    'It naps on its back at the surface, wrapped in a kelp strand so it does not drift away.',
    'It cracks open urchins and shellfish on a flat stone it keeps in a pocket of loose skin.',
    'A mother has a single live pup and carries it on her chest until it learns to swim.',
    'Odd fact: it has a favourite stone and will search the seabed for it if dropped.'] },
  frond_squid: { title: 'The Leaf That Swims', sci: 'Loligo frondosa', lines: [
    '{name} grows ragged, leaf-like flaps along its body that break up its outline.',
    'Colour cells in its skin match the green-gold of the kelp almost perfectly.',
    'It hunts small fish by drifting closer a hair at a time, then striking with two long arms.',
    'Eggs are laid in clusters of soft capsules hung from the underside of kelp blades.',
    'Odd fact: it only reveals itself when moving, because its flaps ripple out of step with the kelp.'] },
  coilback_newt: { title: 'The Stalk Climber', sci: 'Spirocauda laminae', lines: [
    '{name} has a long prehensile tail that wraps around kelp stalks like a spring.',
    'Grippy, ridged toes let it climb in strong swell without losing its hold.',
    'It eats snails and worms picked off the kelp as it climbs.',
    'Eggs are glued one by one to the stalks, each wrapped in a folded kelp leaf.',
    'Odd fact: it sleeps upright, coiled around a stalk like a ribbon on a pole.'] },
  sandveil_skink: { title: 'The Buried Glimmer', sci: 'Psammophis velatus', lines: [
    '{name} has smooth, slippery scales and a wedge-shaped snout for diving into sand.',
    'Its eyes sit high on its head, so it can watch the water while the rest stays buried.',
    'It waits under the sand for passing worms and small crabs, then darts out.',
    'Eggs are buried in warm sand at the forest edge and left to hatch on their own.',
    'Odd fact: it breathes through a thin gap between its scales while fully buried.'] },
  bell_kelp: { title: 'The Ringing Forest', sci: 'Laminaria campanulata', lines: [
    '{name} grows bell-shaped floats full of gas that hold its fronds up toward the light.',
    'A root-like holdfast grips the seabed so tightly that storms rarely tear it free.',
    'It has no sexes: it spreads by releasing clouds of spores from the frond tips.',
    'Odd fact: it can grow a hand-span in a single day in the warm season.'] },

  // ---------------------------------------------------------------- Coral Shelf
  fanray_damsel: { title: 'The Coral Warden', sci: 'Pomacentrus flabellatus', lines: [
    '{name} has fan-like fins that let it hover and turn on the spot in front of its coral.',
    'Each fish claims one coral head and chases off anything bigger than itself.',
    'It tends a little garden of algae on its coral and grazes it carefully.',
    'Eggs are laid on a cleaned patch of coral and fanned by the male until they hatch.',
    'Odd fact: it always returns to the same coral, even after being chased far away.'] },
  coral_whelk: { title: 'The Reef Wanderer', sci: 'Buccinum corallinum', lines: [
    '{name} has a knobbly shell that mimics the bumpy texture of the coral it crawls on.',
    'It sniffs out food with a long breathing tube held up like a snorkel.',
    'It eats the leftovers other reef creatures miss, keeping the coral clean.',
    'Eggs are laid in little stacked capsules shaped like coins.',
    'Odd fact: algae grow on its shell, giving it its own camouflage garden.'] },
  pincer_hermit: { title: 'The House Mover', sci: 'Paguristes forcipatus', lines: [
    '{name} has a soft, curled body that it keeps safe inside an empty shell.',
    'One claw is much bigger than the other and is used as a front door when it hides.',
    'It trades up to a bigger shell as it grows and checks every empty shell it finds.',
    'Females carry eggs inside the shell and release the larvae at night.',
    'Odd fact: when shells are scarce, several hermits queue up by size to swap homes.'] },
  reef_mimic: { title: 'The Thousand Faces', sci: 'Octopus mimeticus', lines: [
    '{name} can change its skin colour and even its texture to raise coral-like bumps.',
    'With no bones it can squeeze through any gap larger than its own eye.',
    'It hunts crabs at dusk, gliding over the reef like a drifting shadow.',
    'A mother guards her eggs in a den and fans them with water until they hatch.',
    'Odd fact: it seems to choose which coral to copy based on whatever it is resting beside.'] },
  fire_coral: { title: 'The Burning Branches', sci: 'Millepora ignea', lines: [
    '{name} is lined with tiny stinging cells that fire when anything brushes past quickly.',
    'Its stinging cells catch drifting plankton, and tiny algae living inside it share sugars too.',
    'It has no sexes: new branches bud from old ones, and broken pieces regrow.',
    'Odd fact: it only stings fast movers: a slow, gentle touch barely triggers it.'] },
  ridgeback_basker: { title: 'The Sun-Watcher', sci: 'Cristosaurus apricus', lines: [
    '{name} has a tall ridge of thin skin along its back that soaks up the morning sun.',
    'Warming up at the waterline gives it the energy to dive and hunt.',
    'It eats sea grapes and small crabs from the shallow reef.',
    'Eggs are laid in warm sand above the high-water line.',
    'Odd fact: it turns its ridge side-on to the sun when cold and edge-on when too hot.'] },
  coral_viper: { title: 'The Coiled Arrow', sci: 'Hydrophis corallinus', lines: [
    '{name} has a flattened, paddle-shaped tail that drives it through the water like an oar.',
    'Banded colours warn other hunters to leave it alone.',
    'It hunts small fish hiding in coral holes, then rests coiled in a crevice to digest.',
    'Eggs are laid in a hidden nook of the reef, deep inside the coral.',
    'Odd fact: it can rest for a whole day after a big meal and barely move at all.'] },
  brain_coral: { title: 'The Thinking Stone', sci: 'Diploria labyrinthica', lines: [
    '{name} grows in winding grooves; each groove is lined with tiny polyps.',
    'The grooves channel water across the colony, carrying food to every polyp.',
    'It has no sexes: the colony grows by its polyps splitting, very slowly, over many years.',
    'Odd fact: its grooves are never the same twice; no two domes share a pattern.'] },

  // ---------------------------------------------------------------- Deep Trench
  lanternjaw: { title: 'The Deep Lamplighter', sci: 'Photostoma laternarium', lines: [
    '{name} grows a glowing lure on a stalk from its forehead, lit by friendly bacteria.',
    'Its wide jaw and stretchy stomach let it swallow prey nearly its own size.',
    'It hunts little fish drawn in by the light, waiting almost perfectly still.',
    'Eggs float up in a jelly raft toward warmer, shallower water to hatch.',
    'Odd fact: it can dim its lure to nothing when something bigger swims past.'] },
  vent_shell: { title: 'The Wall Clinger', sci: 'Ventrilocus tenax', lines: [
    '{name} has a broad, domed shell and a powerful foot that seals it flat against rock.',
    'It scrapes mineral-loving microbes off the trench walls.',
    'Its grip is so strong that the trench currents cannot shift it.',
    'Eggs are laid in a tight spiral under the edge of its own shell.',
    'Odd fact: it wears the same rock bump smooth by always returning to one spot.'] },
  abyss_drifter: { title: 'The Pulse in the Dark', sci: 'Medusa abyssalis', lines: [
    '{name} is clear as water, so it vanishes completely in the deep.',
    'Rings of light run around its bell when it pulses, startling anything that touches it.',
    'Trailing threads catch tiny drifting animals and pass them up to its mouth.',
    'It releases eggs into the water, and the young begin as tiny stalks fixed to the rock.',
    'Odd fact: its glow is brightest when it feels threatened, like a flash of surprise.'] },
  trenchmaw: { title: 'The Waiting Dark', sci: 'Architeuthis profunda', lines: [
    '{name} hides its long body in crevices and waits with two strike arms coiled back.',
    'Huge eyes catch the faintest light, even from glowing creatures far away.',
    'It ambushes fish and squid that wander too close to its hiding place.',
    'Eggs are laid in a huge drifting sheet of jelly, released in the deepest water.',
    'Odd fact: it is rarely seen, and may live longer than any other creature in the sea.'] },
  glow_tuft: { title: 'The Trench Lantern', sci: 'Lucicoma abyssi', lines: [
    '{name} glows with light made by the bacteria living in its soft tufts.',
    'The glow draws tiny drifting animals, whose leftovers feed the tuft.',
    'It has no sexes: it spreads by sending out creeping runners along the rock.',
    'Odd fact: whole trench slopes glow in patches because of it.'] },

  // ---------------------------------------------------------------- Flooded Cave
  blindgill: { title: 'The Sightless Listener', sci: 'Typhlichthys sentiens', lines: [
    '{name} has no eyes at all; in the dark they would only be a waste.',
    'A line of pressure-sensing pores along its sides feels every ripple in the water.',
    'It finds food by touch and taste: cave shrimp, worms and drifting scraps.',
    'Eggs are laid in a quiet pool and guarded by the parent that senses the most ripples.',
    'Odd fact: it can tell a still swimmer from a moving one just by the water on its skin.'] },
  cave_newt: { title: 'The Rock Shadow', sci: 'Speleotriton petricolor', lines: [
    '{name} has rough, grey-brown skin that looks just like wet cave stone.',
    'Its small eyes are tuned to the faint glow of cave minerals.',
    'It eats cave shrimp and insects that fall in from the cracks above.',
    'Eggs are hidden under flat stones in still water.',
    'Odd fact: it can go months without eating when food is scarce.'] },
  stoneshell: { title: 'The Living Pebble', sci: 'Lithocochlea lenta', lines: [
    '{name} has a heavy, rock-coloured shell that is almost impossible to tell from the cave wall.',
    'Its thick shell protects it from falling stones.',
    'It grazes on the thin film of microbes that grows on damp rock.',
    'Eggs are laid in hollow pockets of the cave wall and sealed with a little limestone cap.',
    'Odd fact: it moves less than a hand-span in an hour.'] },
  cave_crawler: { title: 'The Long-Legged Hunter', sci: 'Speleocarcinus magnus', lines: [
    '{name} has very long, thin legs that feel their way across the dark floor.',
    'Its legs are covered in fine hairs that taste and feel the water.',
    'It hunts smaller crabs and blind fish with a quick, darting rush.',
    'Females carry eggs under the tail for months in the cold water.',
    'Odd fact: it grows as big as a king crab, despite eating very little.'] },
  mineral_bloom: { title: 'The Stone Flower', sci: 'Crystallanthus speleus', lines: [
    '{name} is a crust of living film that grows mineral crystals as it feeds on dissolved stone.',
    'Its crystals glow softly and scatter the light, so it seems to glitter in the dark.',
    'It has no sexes: new blooms start where crystal flakes break off and settle.',
    'Odd fact: it grows only a grain a year, so the largest blooms are very, very old.'] },

  // ---------------------------------------------------------------- Open Ocean
  driftfin: { title: 'The Blue Wanderers', sci: 'Vagipinnis caerulea', lines: [
    '{name} has a long, slim body and a deeply forked tail for cruising over great distances.',
    'Its blue back and silver belly make it hard to see from above or below.',
    'Schools follow the plankton blooms across the open ocean.',
    'Eggs are scattered freely in open water and drift with the current.',
    'Odd fact: a school can swim for days without ever stopping to rest.'] },
  blue_runner: { title: 'The Curious Wave-Rider', sci: 'Delphinus inquisitor', lines: [
    '{name} breathes air through a blowhole on top of its head.',
    'It makes clicks and whistles to find food and talk to its pod.',
    'It eats fish, often herding schools into tight balls before diving in.',
    'A mother gives birth to a single live calf and nurses it for over a year.',
    'Odd fact: it is famously curious, and will stop to look at anything new.'] },
  open_drifter: { title: 'The Ocean Lantern', sci: 'Pelagia errans', lines: [
    '{name} drifts with the currents and pulses its bell only to stay near the surface.',
    'Its trailing threads are lined with stingers that catch tiny drifting animals.',
    'Its soft body is mostly water, so few hunters find it worth the trouble.',
    'It releases eggs into the water, and the young start life as tiny stalks fixed to rock.',
    'Odd fact: its stingers only fire when something grabs it quickly.'] },
  longneck_sea_lizard: { title: 'The Breath-Holder', sci: 'Collosaurus pelagicus', lines: [
    '{name} has a very long neck that lets it reach the surface to breathe without lifting its body.',
    'Valves in its nostrils close tight when it dives.',
    'It eats fish and squid, sweeping its long neck sideways to snap them up.',
    'It comes ashore on quiet islands to bury its eggs in warm sand.',
    'Odd fact: it can hold its breath for nearly an hour while hunting.'] },
  floating_weed_mat: { title: 'The Drifting Island', sci: 'Sargassum natans', lines: [
    '{name} stays afloat thanks to tiny gas-filled berries along its stems.',
    'Small fish, crabs and shrimp shelter under it out on the open water.',
    'It has no sexes: it grows by breaking into pieces that drift away and keep growing.',
    'Odd fact: a single mat can drift around the whole ocean over many years.'] },
  reeftooth: { title: 'The Patrolling Fin', sci: 'Carcharhinus orbitans', lines: [
    '{name} has rows of replaceable teeth, so a lost tooth is never a problem.',
    'It keeps swimming to push water over its gills.',
    'It patrols the same route each day, checking each turning point for prey.',
    'Eggs are laid in tough leathery cases hooked onto rocks.',
    'Odd fact: it can sense the tiny electric pulses of a beating heart.'] },
  wandershell_nautilus: { title: 'The Living Spiral', sci: 'Nautilus peregrinus', lines: [
    '{name} lives in the outer chamber of a coiled shell divided into many sealed rooms.',
    'It adjusts the gas in the inner chambers to float up or sink down, like a submarine.',
    'It scavenges at night, rising from deeper water to feed.',
    'Eggs are laid one at a time and take nearly a year to hatch.',
    'Odd fact: it can live for many decades, adding one new chamber at a time.'] },
  crimsonback: { title: 'The Red Leapers', sci: 'Rubidorsum saliens', lines: [
    '{name} is red inside and out, its colour coming from the tiny red shrimp it eats.',
    'Its strong tail lets it leap clear of the water when chasing prey near the surface.',
    'Schools roam the whole open ocean, from deep water to the surface.',
    'Eggs are laid in cold, clear water and hatch into nearly colourless fry.',
    'Odd fact: young fish only turn red once they start eating shrimp.'] },
  ironfin: { title: 'The Burst Swimmer', sci: 'Ferropinna celeris', lines: [
    '{name} has stiff, iron-grey fins built for short, powerful bursts of speed.',
    'After a burst it must glide and rest while its muscles recover.',
    'It hunts alone, surprising small fish with a sudden dash.',
    'Eggs are scattered over open water in the warm season.',
    'Odd fact: its burst is so fast it leaves a tiny trail of bubbles.'] },

  // ---------------------------------------------------------------- Sunken Ruins
  porthole_darter: { title: 'The Window Fish', sci: 'Fenestrichthys agilis', lines: [
    '{name} has a narrow, flat body that slips easily through portholes and cracks.',
    'It knows every gap in its wreck and uses them as escape routes.',
    'It picks tiny shrimp off the rusted metal.',
    'Eggs are laid inside the wreck, in sheltered corners away from the current.',
    'Odd fact: each fish has a favourite porthole it peers out of.'] },
  rustclaw: { title: 'The Iron-Coloured Crab', sci: 'Cancer ferruginus', lines: [
    '{name} has a rough, rust-red shell that blends with corroded metal.',
    'It is very nervous and freezes at the first hint of sudden movement.',
    'It eats the algae and tiny animals that grow on old metal.',
    'Females carry their eggs under the tail, hidden in the darkest corner of the wreck.',
    'Odd fact: its shell gets rustier-looking with age.'] },
  chest_octopus: { title: 'The Barrel Dweller', sci: 'Octopus arcanus', lines: [
    '{name} makes its home in old barrels and chests, closing the lid with an arm.',
    'With no bones, it can squeeze through the smallest crack.',
    'It slips out to catch crabs, then hurries back home.',
    'A mother guards her eggs inside her barrel until they hatch.',
    'Odd fact: it decorates the barrel opening with shells and shiny scraps.'] },
  wreck_eel: { title: 'The Corridor Hunter', sci: 'Muraena naufragii', lines: [
    '{name} has a long body of tiny, smooth scales that slides easily through tight corridors.',
    'Its small fins make it fast in narrow spaces but slow in open water.',
    'It hunts fish inside the wreck at night.',
    'Eggs are laid in a hidden pocket deep inside the ship.',
    'Odd fact: it opens and shuts its mouth constantly, not to threaten, but to breathe.'] },
  barnacle_crawler: { title: 'The Crusted Wanderer', sci: 'Balanicola reptans', lines: [
    '{name} carries a crust of real barnacles on its shell, which hide it on old wood.',
    'It inches along on a broad foot, grazing algae as it goes.',
    'There are no males or females: every crawler is both at once.',
    'It releases clouds of tiny eggs that drift until they settle on wood or metal.',
    'Odd fact: the barnacles on its back get a free ride to new feeding spots.'] },
  rustweed: { title: 'The Iron Garden', sci: 'Ferrophyta rubiginosa', lines: [
    '{name} grows only on old metal, drawing iron from the rust.',
    'The iron gives it its reddish colour.',
    'It has no sexes: new fronds sprout from runners across the metal.',
    'Odd fact: the oldest wrecks are covered in it, like a red carpet.'] },

  // ---------------------------------------------------------------- Volcanic Vents
  ember_goby: { title: 'The Vent Spark', sci: 'Gobius ignifer', lines: [
    '{name} is orange as a coal and loves water warmed by the vents.',
    'It darts into vent cracks to hide, where few hunters can follow.',
    'It eats tiny shrimp that live on the warm rocks.',
    'Eggs are laid inside warm cracks, where they hatch quickly.',
    'Odd fact: it sits on warm rocks to warm itself, like a lizard in the sun.'] },
  sulfur_crab: { title: 'The Yellow Guard', sci: 'Thiocarcinus armatus', lines: [
    '{name} has a yellow-stained shell from living beside sulfur vents.',
    'It raises its claws in warning when something comes close, but calms quickly.',
    'It eats the microbes that grow around the vents.',
    'Females carry their eggs under the tail, keeping them warm by the vents.',
    'Odd fact: it never strays far from the warm water.'] },
  vent_limpet: { title: 'The Plume-Sitter', sci: 'Patella fumaria', lines: [
    '{name} has a low, cone-shaped shell that sheds the hot plumes.',
    'It clings to the rock right where the warm water flows.',
    'It grazes the microbes that grow in the warm vent water.',
    'Eggs are released in the warm water and drift until they settle on a vent.',
    'Odd fact: it can survive water hot enough to cook most other snails.'] },
  vent_salamander: { title: 'The Warm-Water Walker', sci: 'Pyrotriton fumarolis', lines: [
    '{name} has thick, heat-resistant skin for living beside the vents.',
    'It basks in the warm currents to keep its body warm.',
    'It eats worms and small crabs that live around the vents.',
    'Eggs are laid in warm cracks, where they hatch quickly.',
    'Odd fact: it gets jumpy right after a plume passes, as if the warmth wakes it up.'] },
  vent_moss: { title: 'The Warm Carpet', sci: 'Thermobryum velutinum', lines: [
    '{name} grows in thick, fuzzy mats on the warm rocks around the vents.',
    'It feeds on minerals from the vent water instead of sunlight.',
    'It has no sexes: it spreads by drifting fragments that root on warm rock.',
    'Odd fact: small creatures hide in it to stay warm.'] },

  // ---------------------------------------------------------------- Mangrove Roots
  rootback_mudskipper: { title: 'The Fish That Walks', sci: 'Periophthalmus radicum', lines: [
    '{name} walks on strong front fins, and can climb onto roots out of the water.',
    'It keeps a little water in its gill chambers to breathe while out of the water.',
    'It eats insects and tiny crabs on the mud.',
    'Eggs are laid in a burrow in the mud, guarded by the father.',
    'Odd fact: its eyes stick up on top of its head so it can watch above and below the water.'] },
  mangrove_fiddler: { title: 'The One-Clawed Musician', sci: 'Uca radicola', lines: [
    '{name} males have one huge claw, waved in the air to impress females.',
    'It freezes in place rather than run when danger comes close.',
    'It eats tiny bits of food sifted from the mud.',
    'Females carry eggs under the tail, then release the larvae into the water.',
    'Odd fact: males wave their big claw in a little rhythm, like a dance.'] },
  rootcoil_snake: { title: 'The Root Ribbon', sci: 'Radicophis spiralis', lines: [
    '{name} wraps itself tightly around roots, where its brown scales blend in.',
    'It can stay still for hours, waiting for prey.',
    'It eats small fish and crabs that come too close.',
    'Eggs are laid in a hollow root above the water.',
    'Odd fact: it can hold onto a root with just the tip of its tail.'] },
  dwarf_croc: { title: 'The Small Ambusher', sci: 'Crocodylus minor', lines: [
    '{name} lies with only its eyes and nostrils above the water.',
    'Its powerful jaws close very fast, but it rarely chases prey far.',
    'It eats fish, crabs and anything else that comes too close.',
    'Eggs are laid in a mound of rotting leaves that keeps them warm, guarded by the mother.',
    'Odd fact: the mother carries hatchlings to the water gently in her mouth.'] },
  bankside_monitor: { title: 'The Mud Patroller', sci: 'Varanus ripicola', lines: [
    '{name} has a long, strong tail for swimming and a forked tongue for tasting the air.',
    'It patrols the muddy banks each day, looking for food.',
    'It eats crabs, eggs and anything it can catch.',
    'Eggs are buried in warm mud above the waterline.',
    'Odd fact: its forked tongue can taste which direction food is in.'] },
  muckhide_octopus: { title: 'The Mud Dweller', sci: 'Octopus limosus', lines: [
    '{name} buries itself in the mud, with only its eyes poking out.',
    'With no bones, it can squeeze into the smallest gaps among the roots.',
    'It eats crabs and shrimp that walk over its hiding place.',
    'A mother guards her eggs in a mud burrow until they hatch.',
    'Odd fact: it is easily tempted out by a tasty bit of bait.'] },
  root_tangle: { title: 'The Knotted Shelter', sci: 'Rhizophora implexa', lines: [
    '{name} grows arching roots that hold it up above the mud.',
    'Its roots filter salt from the water so it can drink seawater.',
    'It has no sexes: it grows new shoots from its roots, and dropped cuttings take root.',
    'Odd fact: many small creatures make their homes among its roots.'] },

  // ---------------------------------------------------------------- Ice Shelf
  frostfin: { title: 'The Ice Darters', sci: 'Glacichthys agilis', lines: [
    '{name} has special proteins in its blood that keep it from freezing.',
    'Schools dart through the gaps between ice in tight formation.',
    'It eats tiny shrimp that live just under the ice.',
    'Eggs are laid under the ice, where they hatch slowly in the cold.',
    'Odd fact: its blood is almost clear in the coldest water.'] },
  iceback_seal_pup: { title: 'The Ice Lounger', sci: 'Phoca glacialis', lines: [
    '{name} has a thick layer of blubber that keeps it warm in icy water.',
    'It lounges on the ice to rest, diving quickly when danger comes.',
    'It eats fish caught under the ice.',
    'A mother gives birth to a single live pup on the ice and nurses it until it can swim.',
    'Odd fact: it can sleep floating upright in the water, with its nose poking out to breathe.'] },
  frost_isopod: { title: 'The Ice Ceiling Walker', sci: 'Glacioniscus pendulus', lines: [
    '{name} clings upside down to the underside of the ice with hooked legs.',
    'Its flat, armoured body keeps it close to the ice.',
    'It eats the algae that grow on the underside of the ice.',
    'Females carry their eggs in a pouch under their body until they hatch.',
    'Odd fact: it can live its whole life without ever touching the seabed.'] },
  iceshell_snail: { title: 'The Glass Snail', sci: 'Hyalocochlea glacialis', lines: [
    '{name} has a thin, clear shell that makes it almost invisible.',
    'It moves extremely slowly to save energy in the cold.',
    'It grazes on the algae under the ice.',
    'Eggs are laid in clear jelly under the ice.',
    'Odd fact: you can see its tiny heart beating through its shell.'] },

  // ---------------------------------------------------------------- Half-Flooded Lush Cave
  azalea_axolotl: { title: 'The Pink Smile', sci: 'Ambystoma azaleum', lines: [
    '{name} keeps its feathery gills its whole life, breathing water like a youngster forever.',
    'Its rosy colour comes from the blood showing through its thin, pale skin.',
    'It slurps up worms, shrimp and snails with a sudden gulp.',
    'Eggs are stuck one by one to cave plants, and the babies are always pink like their parents.',
    'Odd fact: it can regrow a lost leg, gill, or even part of its heart.'] },
  aurum_axolotl: { title: 'The Golden Rarity', sci: 'Ambystoma aureum', lines: [
    '{name} has golden skin, coloured by shimmering pigment cells.',
    'Like all axolotls, it keeps its feathery gills its whole life.',
    'It eats worms, shrimp and snails from the cave floor.',
    'Eggs are stuck to cave plants, and the babies are always golden like their parents.',
    'Odd fact: it is the rarest axolotl colour in the lush cave.'] },
  pluvia_axolotl: { title: 'The Rain Colour', sci: 'Ambystoma pluviale', lines: [
    '{name} has pale cyan skin, the colour of rainwater in the cave light.',
    'Its feathery gills catch oxygen from the still cave water.',
    'It eats small worms and shrimp from among the plants.',
    'Eggs are stuck to cave plants, and the babies are always cyan like their parents.',
    'Odd fact: its colour looks brighter on rainy days, when more water drips into the cave.'] },
  viridis_axolotl: { title: 'The Moss Dweller', sci: 'Ambystoma viride', lines: [
    '{name} has moss-green skin that blends in among the cave plants.',
    'It rests among the plants for hours, barely moving.',
    'It eats worms, snails and tiny shrimp from the plants.',
    'Eggs are stuck to cave plants, and the babies are always green like their parents.',
    'Odd fact: algae sometimes grow lightly on its skin, making it even greener.'] },
  navious_axolotl: { title: 'The Deep Blue', sci: 'Ambystoma navium', lines: [
    '{name} has deep blue skin, the colour of the sea far from shore.',
    'Like all axolotls, it never grows out of its feathery gills.',
    'It eats worms, shrimp and snails from the cave floor.',
    'Eggs are stuck to cave plants, and the babies are always blue like their parents.',
    'Odd fact: its blue looks almost black in deep shadow.'] },

  // ---------------------------------------------------------------- the day & night update creatures
  auroravein_squid: { title: 'The Northern Lights', sci: 'Loligo borealis', lines: [
    '{name} glows with pale green-violet veins that pulse with light.',
    'It comes out only on calm nights, drifting slowly under the ice.',
    'It eats tiny shrimp drawn to its glow.',
    'Eggs are laid in clusters under the ice and hatch with their glow already on.',
    'Odd fact: the patterns in its veins are different for every squid.'] },
  moonshell_crab: { title: 'The Moon-Pale Crab', sci: 'Carcinus lunaris', lines: [
    '{name} has a pale, moonstone shell that glows faintly in moonlight.',
    'It comes out only at night, when its shell blends into the moonlit sand.',
    'It freezes when something comes close, hoping not to be seen.',
    'Females carry their eggs under the tail and release the larvae on full-moon nights.',
    'Odd fact: its glow fades in the day, so it hides under rocks until dark.'] },
  ribbonmane: { title: 'The Mirror Dancer', sci: 'Hippocampus imitans', lines: [
    '{name} has flowing ribbon fins that wave like a mane as it swims.',
    'It copies the movements of other creatures, mirrored, as a way of greeting.',
    'It eats tiny shrimp, sucking them in with its long snout.',
    'Eggs are laid in a pouch on the father, who carries them until they hatch.',
    'Odd fact: if you hold perfectly still, it may drift right up to you.'] },
  candlepolyp: { title: 'The Night Candle', sci: 'Lucernaria nocturna', lines: [
    '{name} stays closed tight by day to hide from hungry fish.',
    'At night its tips open and glow like little candles.',
    'Its glow attracts tiny drifting animals, which it catches with its tips.',
    'It has no sexes: new polyps bud from the base of old ones.',
    'Odd fact: a whole patch opens at once, as if someone lit them all together.'] },
  skyleap_flyfish: { title: 'The Sky Leaper', sci: 'Exocoetus caelestis', lines: [
    '{name} has very large, wing-like fins that let it glide through the air.',
    'It leaps out of the water to escape hungry fish below.',
    'It eats tiny plankton near the surface.',
    'Eggs are laid on floating weed, attached by sticky threads.',
    'Odd fact: it can glide for many body-lengths before splashing back down.'] },
  sail_turtle: { title: 'The Gentle Giant', sci: 'Velichelys magna', lines: [
    '{name} has a tall, sail-like ridge on its shell that catches currents.',
    'It sails slowly through the open ocean, letting the currents carry it.',
    'It eats jellyfish and floating weed.',
    'Eggs are buried in sand on quiet beaches, and the hatchlings head straight for the sea.',
    'Odd fact: it can travel across the whole ocean in its lifetime.'] },
  pressure_tortoise: { title: 'The Deep Fortress', sci: 'Barychelys profunda', lines: [
    '{name} has a thick, heavy shell built to withstand the crushing pressure of the deep.',
    'It pulls into its shell when startled, waiting until it feels safe again.',
    'It eats the microbes and scraps that sink to the trench floor.',
    'Eggs are laid in a hollow at the very bottom of the trench and take years to hatch.',
    'Odd fact: it may live for hundreds of years in the cold, still deep.'] },
  bellcrab: { title: 'The Ringing Crab', sci: 'Campanocarcinus resonans', lines: [
    '{name} has a little bell-shaped hollow in its shell.',
    'The hollow makes a soft ringing sound when it taps its claws against it.',
    'It eats algae and tiny animals that grow on old metal.',
    'Females carry eggs under the tail, hidden in the hollow.',
    'Odd fact: crabs ring their bells to call to each other across the wreck.'] },
  firefly_frog: { title: 'The Light Trickster', sci: 'Lampyrana illicium', lines: [
    '{name} grows a glowing decoy on a stalk, which glows like a firefly.',
    'It comes out only at night, when its light is most visible.',
    'Insects and small fish are drawn to the light, then snapped up by the frog beside it.',
    'Eggs are laid in quiet water among the roots, and the tadpoles glow faintly too.',
    'Odd fact: the decoy is so convincing that other frogs sometimes try to eat it.'] },
  // ---------------------------------------------------------------- Starfall (falling stars)
  starfall_minnow: { title: 'The Little Lights from Above', sci: 'Astrichthys minutus', lines: [
    '{name} glows from a row of tiny lamps along its belly, soft enough to hide it against the stars.',
    'Shoals ride the cold wake of a falling star down into the sea, feeding on the specks it scatters.',
    'They lay clear, glimmering eggs on floating weed; the fry hatch already faintly lit.',
    'Odd fact: a shoal flickers in step, like one small constellation turning over.'] },
  aerolite_crab: { title: 'The Stone That Walked Ashore', sci: 'Meteorocarcinus lapis', lines: [
    '{name} grows a pitted grey shell, scorched-looking at the edges, that passes for a fallen pebble.',
    'It turns up where a star has struck the shore and picks warm grit from the fresh crater.',
    'Females carry their amber eggs beneath the tail until the young scatter into the tide.',
    'Odd fact: its shell holds a little of the day\'s warmth, and glows faintly long after dark.'] },
  comet_ray: { title: 'The Tail of the Shower', sci: 'Cometobatis caudalux', lines: [
    '{name} flies through the water on wide, slow wings, trailing a long tail that glows like a comet.',
    'It sweeps up drifting specks of stardust in the shallows on nights when the sky is busiest.',
    'It lays a few dark, leathery egg cases that rest on the sand until the pups slip out.',
    'Odd fact: it is curious about lights, and will turn to look at a lantern held still.'] },
};
