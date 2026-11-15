// Embedded, kid-safe English word lists.
// GENERAL holds common words; THEMES add emoji + one-line kid-friendly definitions.
// Everything is normalised to lowercase a–z, 3–8 letters, deduplicated.

const GENERAL = `
able about above act add afraid after again age ago agree ahead aim air alarm alike alive all allow almost alone
along aloud already also always amaze among amount angle angry answer any apart appear april area army around
arrive arrow art artist ask asleep aunt avoid awake away awful acorn adult agent album alert alien alley amber
apron arena aside atlas attic award absorb accent action active advice almond anchor anthem antler arcade arctic
attach author avenue

baby back bad badge bag bake baker ball balloon band bank barn base basket bath bead beak beam bean beat beauty
because become beef been before begin behind being bell belong below belt bench bend best better between big bike
bill bird birth bit bite black blade blank blend bless blind block blond bloom blow blue board boat bold bolt
book boot border born borrow boss both bottle bottom bounce bowl box boy branch brave break breath breeze brick
bridge brief bright bring broad broken brother brown brush bubble bucket build bulb bump bunch bundle burn burst
bush busy button buy buzz bib bin bow bud bug bun bark blot blur bond bore bunk bacon bagel banjo basin beard
bingo blaze blimp blush boost booth bored brand brass bravo bride broom brook bunny badger ballet bamboo banner
barber barrel beacon beaver beetle beyond bicycle biscuit blender blossom bonnet bronze buckle budget buffet
burrow

cab cabin cage calm can cane cap cape car card care careful cart case castle catch cause cave cell center chain
chair chance change chase cheap check cheer chess chief child chill chip choice choose chop circle city clap
clay clean clear clever cliff climb close cloth club coach coast coat code coin cold collar color comb come comic
common cook cool copy corner cost cotton count country cousin cover crack craft crane crash cream create crew
crib crop cross crowd crown crumb cry cub cube curl curve cut cute cob cod cot cafe calf camp cash cast clam claw
clip clue coal coil cone cord cork crow cuff curb cable canal canoe cargo carol charm chart chime chirp choir
chord chore cider civic claim clamp clash clasp cloak couch crate crawl crisp crust cubby curly cycle camera
canyon carpet cartoon cattle celery cellar cereal chimney chorus circus citrus climber closet clover cobweb cocoa
coffee collect compass concert copper county cradle credit cricket crimson crystal cuddle curtain cushion custard

dad daily dance danger dare dark dawn day dear deep detail diary dig dime dinner dip dirt dish diver dock doctor
doll dollar door dot double dough down dozen dragon drama draw drawer dream dress drift drill drink drip drive
drop drum dry dust duty den dew din doe dug dye dart dash deck dent dial dice dine dive dome dove drag dune dusk
decal decoy delta denim depth diner dingo disco ditch dizzy dodge draft drain drake dried drone dancer dazzle
decade decide degree dentist design desire direct domino driver duckling

each eager early earn easel east easy eat echo edge eight else empty end energy engine enjoy enough enter equal
error even evening event ever every exact exam excite exit expert explore extra eel elm epic elder ember entry
editor effort eighty eleven emerald empire escape examine exhibit

face fact fair fairy fall family famous fan fancy far farm farmer fast father fault favor fear feast feather feed
feel fence few field fill film find fine finish fire first fit five fix flag flake flame flap flash flat flavor
flight float flock flour flow flute fly foam fold folk follow foot forget form fort forty forward found frame free
fresh front fruit full fun funny fur future fed fin fade fawn feet fist flea flip foal fond font fork fowl fuel
fume fuzz fable fence ferry fetch fever fifth fifty final fleet flint flood floss fluff focus foggy forge forum
froze fudge fuzzy fabric falcon fellow fiddle figure flying forever fossil freedom frozen fruity funnel

gain game gate gather gaze gem gentle gift giant girl give glad glass glove glow glue go goal gold golden good
goose grab grade grain grand great green greet grin grip group grow growl guard guess guest guide gum gap gas gel
gale gear germ glee gong gown gulf gull gust gecko genie ghost glare gleam glide globe gloom glory gnome grace
grant graph grasp gravy grill groom grove guava gallon garage gather giggle ginger glider goggles gopher gravel
ground growth guitar

habit half hall hammer handle happen happy harbor hard harp hat hatch have hawk hay heal health hear heat heavy
hedge helmet help herb here hero hide high hike hint history hit hobby hold hole holiday home honest hood hoof
hook hop hope horn hose hot hotel hour hug huge hum human humor hundred hungry hurry hut ham hid him hog hub hue
hail halo hare haze heap heel herd hive hoop hoot hush haven hello humid husky helper hiccup hidden hockey hollow
harvest

idea inch inside invent iron itch ivy item ink iris icing ideal image inbox index inner input iceberg impact
indoor infant

jacket jaw jeans jet jewel job jog join joke jolly journey joy judge jump junior just jab jig jot jug jade jazz
jeep jest jolt joint jumbo jumpy jaguar jasmine jersey jigsaw jingle jockey

kayak keep kick kid kind king kiss kit kitchen knit knock knot know keg kin keen kelp kiln knob knack kennel
kindle kingdom

label lace ladder lady lamb lamp land lane large last late laugh lava lawn lay lazy lead learn leash leave left
lend lens less lesson level lid life lift light like line list listen little live load loaf local lock log long
look loop loose lose lost loud love low loyal luck lucky lunch lab lad lap law lot lug lark leak lean leap limp
link lint loan loft lore lure lush ladle laser latch layer lilac limit linen liner lodge lofty logic lunar lagoon
lantern laptop laundry leader legend lettuce lights locker lotion lovely luggage lumber

mad magic magnet mail main make many maple marble march mark market mask match maze meal mean medal meet melt
member memory menu mess metal middle mild mind mint minute mirror miss mist mix model moment money month more
morning moss most motor move movie much music mat men met mob mop mane mare mast mesh mice mile mill mine moat
mood mule muse mute major marsh mayor merry meter mimic minor mixer molar motel mound muddy mural mammal manner
meadow medium meteor midday mitten modern monster mosaic motion museum mustard myself

nail name nap narrow nation near neat need needle nest net never new next nice night nine noble nod noise noon
north note nothing notice now number nurse nib news newt nook naval nerve newly niece ninja notch novel nylon
napkin nephew nickel normal nutmeg

oak oar odd off offer office often oil old once one only open orbit order other outside oval over own oat ore
oboe opal oasis opera organ outer owner oatmeal object orchard orchid outfit oxygen oyster

pack page pair pajamas palace pan paper parade parent park part pass past paste pat patch path paw peace peak
pebble pedal pen penny people pepper perfect pet piano pick picnic piece pillow pilot pin pine pink pipe pirate
pitch place plain plan plant play please plenty plus pocket poem point polar pole police polite pond pony pool
poor pop porch pot pour powder power praise press pretty price prince print prize proud pull pump push puzzle pad
pal peg pep pit pod pug pun pup pace pail pain palm pane pier pike pile pint plot plow plug poet pore pose post
prop puff pulp puma pure purr paint panel party pause pearl pecan perch picky pinch pixel plaid plane plank plaza
plump pouch pound pride prime prism proof prune pulse paddle panther parcel pastry peanut pelican pencil person
pickle planet poetry polish pollen printer problem puddle puffin puppet

quack quail quart queen quest quick quiet quilt quirk quite quota quote quiz

race radio raft raise rake ramp ranch range rare raven raw reach read ready real reason record red relax remember
rest rhyme ribbon rich ride right ring ripe rise road roar robe robin robot rocket roll roof room root rope round
row royal rub rule ruler run rush rag ram rat ray rib rim rip rod rot rut rack rail rang reed reef rein rely rind
rink risk roam role rook rosy ruby rung rust radar rainy rally rapid razor realm rebus relay remix rider ridge
ripen roast rocky rodeo rough route rugby rumba rusty raccoon random reader recipe relish remote rescue riddle
rubber

sad safe sail salt same sandal save say scale scarf score screen season seat second secret seek seem self sell
send sense seven shade shadow shake shape share sharp shelf shine ship shirt shoe shop short shout show shower shy
side sign silent silk silly silver simple sing sink sister sit six size skate ski skill skip skirt sled sleep
sleeve slice slide slip slow small smart smell smile smoke snack sneeze soap soccer sock soda sofa soft soil some
son song soon sort sound south spark speak special speed spend spin splash sport spot sprout square squash stage
stair stamp stand start station stay steam step stick still stool stop store story stove straw stream street
string strong student study sugar sunny supper sure surf surprise sweater sweep sweet swim swing sag sap sat saw
set sew sip sir sly sob sod sow soy spa spy sub sum sack sage sang scan seam seen shed sift sigh site skid skim
slab slid slim slot slug snap soak soar sole solo soot sour spud stem stew stir such suit sung sunk swap sway
saber salsa sandy sauce sauna scene scent scoop scoot scope scout scrap scrub shady sheet shiny shock shore shrub
sight silky since skunk slate slope smoky sneak sniff snore snowy solar solid spade spare spice spicy spike spine
spoke spray squad stack staff stain stare state steel steep sting stuck stuff style super surge swamp swarm swift
sword syrup saddle safari sailor salmon sample sketch slipper smooth snooze socket sponge stable statue sticker
studio sunset switch symbol

table tail take tale talk tall tank tape taste taxi teach team tear tell ten tent test thank thick thin thing
think third thirsty three throw ticket tidy tie tight time tiny tip tired today together tonight tool top torch
toss touch tour tower town track tractor trade train trap travel tray treat trick trip truck true trumpet trunk
trust truth try tub tune tunnel turn twin twist tab tag tan tap tar tax tin ton tot tow tug two tack task tend
term text than that them then they this tick tide tile till tint tire toga told tone trim trio trot tube tuck
tusk twig type taffy tango tasty teddy theme thorn tiara timer token topic total tough trace trail trend trial
tribe truly tuner twirl tablet tadpole teacher temple tennis thirty thread tickle timber toddler toucan treasure
tricky trophy tuxedo twelve twenty

umbrella uncle under unicorn unit until up upon upset use useful urn used ultra unite unity upper urban usual
uniform unlock upside

valley van vase very vest view village visit voice vote vat vet vane vast veil vein verb visa vole valid value
valve vapor vault video viola vital vivid vocal velvet violet visitor voyage

wagon wait wake walk wall wand want warm wash wasp watch wave wax way weak wear weather web week weigh welcome
well west wet wheat wheel where whisper whistle white whole wide wild win wind wing wise wish wonder wood wool word
work world write wrong wag wed wig wit wok won woo wade wage wail wavy weed went were what when whip wick will wilt
wink wipe wire wore wrap wren waist while whirl whisk widen width windy witch worry worth wrist waffle walnut
walrus wander warmth weekend whisker wizard wooden worker

yard yarn yawn year yell yellow yes yoga young yummy yam yap yet yew yolk your yacht yearn yeast yield youth
zero zip zone zoom zap zen zany zest zinc zesty zigzag zipper
`;

// Themed sub-lists: word|emoji|definition
const THEME_DATA = {
  animals: `
cat|🐱|A small furry pet that purrs and meows.
dog|🐶|A loyal pet that barks and wags its tail.
cow|🐮|A farm animal that gives us milk.
pig|🐷|A pink farm animal that says oink.
hen|🐔|A mother chicken that lays eggs.
fox|🦊|A clever wild animal with a bushy tail.
owl|🦉|A bird that hoots and stays awake at night.
bat|🦇|A flying animal that sleeps upside down.
bee|🐝|A buzzing insect that makes honey.
ant|🐜|A tiny insect that lives in big busy groups.
yak|🐃|A hairy ox that lives in cold mountains.
emu|🐦|A tall bird from Australia that cannot fly.
elk|🦌|A large deer with wide antlers.
ape|🦍|A big, clever animal like a gorilla.
bear|🐻|A big furry animal that loves honey.
lion|🦁|A big cat called the king of the jungle.
frog|🐸|A green hopper that says ribbit.
duck|🦆|A water bird that says quack.
goat|🐐|A farm animal with horns that loves to climb.
seal|🦭|A sea animal that claps its flippers.
crab|🦀|A sea creature that walks sideways.
wolf|🐺|A wild dog that howls at the moon.
deer|🦌|A gentle forest animal that can leap high.
swan|🦢|A graceful white bird with a long neck.
mole|🕳️|A small digger that lives underground.
toad|🐸|A bumpy cousin of the frog.
moth|🦋|A night-time insect that loves lights.
lamb|🐑|A baby sheep.
mouse|🐭|A tiny animal with a long tail.
horse|🐴|A strong animal you can ride.
sheep|🐑|A woolly farm animal that says baa.
tiger|🐯|A big orange cat with black stripes.
zebra|🦓|A horse-like animal with black and white stripes.
camel|🐫|A desert animal with humps on its back.
koala|🐨|A sleepy tree animal from Australia.
panda|🐼|A black and white bear that eats bamboo.
whale|🐋|The biggest animal in the ocean.
shark|🦈|A fast fish with lots of sharp teeth.
snake|🐍|A long animal with no legs.
eagle|🦅|A big bird with super sharp eyes.
snail|🐌|A slow creature that carries its shell.
llama|🦙|A fluffy animal from the mountains.
hippo|🦛|A huge animal that loves to sit in water.
rhino|🦏|A big animal with a horn on its nose.
squid|🦑|A sea animal with ten arms.
chick|🐤|A baby bird, fluffy and yellow.
puppy|🐶|A baby dog.
otter|🦦|A playful animal that floats on its back.
rabbit|🐰|A hopping animal with long ears.
monkey|🐵|A playful animal that swings in trees.
turtle|🐢|A slow animal with a shell for a home.
parrot|🦜|A colorful bird that can copy words.
donkey|🫏|A farm animal with long ears that says hee-haw.
spider|🕷️|An eight-legged animal that spins webs.
kitten|🐱|A baby cat.
lizard|🦎|A small reptile that loves sunshine.
beaver|🦫|An animal that builds dams with its teeth.
giraffe|🦒|The tallest animal, with a very long neck.
dolphin|🐬|A smart sea animal that loves to play.
penguin|🐧|A bird that swims but cannot fly.
octopus|🐙|A sea animal with eight arms.
hamster|🐹|A tiny pet that stuffs food in its cheeks.
peacock|🦚|A bird with a huge, colorful tail.
ladybug|🐞|A red beetle with black spots.
squirrel|🐿️|A bushy-tailed animal that collects nuts.
flamingo|🦩|A pink bird that stands on one leg.
`,
  food: `
apple|🍎|A crunchy fruit that grows on trees.
banana|🍌|A long yellow fruit you peel.
grape|🍇|A small round fruit that grows in bunches.
pear|🍐|A sweet fruit shaped like a bell.
peach|🍑|A soft, fuzzy, sweet fruit.
plum|🟣|A juicy purple fruit with a stone inside.
lemon|🍋|A sour yellow fruit.
lime|🍈|A small, sour green fruit.
mango|🥭|A sweet tropical fruit with orange inside.
melon|🍈|A big juicy fruit with lots of seeds.
cherry|🍒|A small red fruit with a stone.
berry|🫐|A small juicy fruit like a blueberry.
kiwi|🥝|A fuzzy brown fruit, green inside.
orange|🍊|A round citrus fruit full of juice.
fig|🟤|A soft sweet fruit full of tiny seeds.
date|🌴|A sweet brown fruit from palm trees.
coconut|🥥|A hard, hairy nut with milk inside.
carrot|🥕|An orange vegetable that rabbits love.
corn|🌽|Yellow kernels that grow on a cob.
pea|🫛|A tiny green ball that grows in a pod.
bean|🫘|A seed you can cook and eat.
potato|🥔|A vegetable that grows underground.
tomato|🍅|A red, juicy fruit used in sauces.
onion|🧅|A vegetable with layers that can make you cry.
garlic|🧄|A strong-smelling bulb used in cooking.
bread|🍞|A food baked from flour, used for sandwiches.
cake|🎂|A sweet baked treat for parties.
pie|🥧|A baked crust filled with fruit or more.
cookie|🍪|A small, sweet baked snack.
pizza|🍕|A round flat bread with cheese and toppings.
soup|🍲|A warm liquid food eaten with a spoon.
rice|🍚|Tiny grains that are cooked and eaten.
egg|🥚|An oval food laid by hens.
milk|🥛|A white drink that helps build strong bones.
cheese|🧀|A food made from milk.
honey|🍯|A sweet, sticky food made by bees.
jam|🍓|A sweet fruit spread for toast.
taco|🌮|A folded shell filled with tasty food.
pasta|🍝|Noodles made from flour and water.
salad|🥗|A bowl of mixed fresh vegetables.
toast|🍞|Bread that has been warmed until crispy.
cupcake|🧁|A small cake baked in a paper cup.
candy|🍬|A sweet treat made with sugar.
juice|🧃|A drink squeezed from fruit.
tea|🍵|A warm drink made from leaves.
donut|🍩|A sweet fried ring of dough.
pancake|🥞|A flat round cake cooked in a pan.
popcorn|🍿|Corn that pops when heated.
butter|🧈|A creamy spread made from milk.
noodle|🍜|A long, thin strip of pasta.
yogurt|🥣|A creamy food made from milk.
waffle|🧇|A crispy cake with little squares.
broccoli|🥦|A green vegetable that looks like a tiny tree.
pumpkin|🎃|A big orange squash.
nut|🥜|A seed with a hard shell.
muffin|🧁|A small, soft baked treat.
sandwich|🥪|Food between two slices of bread.
cereal|🥣|Breakfast grains eaten with milk.
`,
  nature: `
sun|☀️|The bright star that gives us daylight.
tree|🌳|A tall plant with a trunk and branches.
leaf|🍃|A flat green part of a plant.
rain|🌧️|Water drops falling from clouds.
snow|❄️|Soft white ice flakes falling from the sky.
wind|🌬️|Moving air you can feel but not see.
cloud|☁️|A fluffy white shape floating in the sky.
river|🏞️|A long stream of flowing water.
lake|🏞️|A big pool of water with land all around.
sea|🌊|A huge area of salty water.
ocean|🌊|The biggest body of salty water.
hill|⛰️|A small mountain.
rock|🪨|A hard piece of stone.
sand|🏖️|Tiny grains found on beaches.
flower|🌸|The colorful part of a plant.
rose|🌹|A sweet-smelling flower with thorns.
grass|🌱|Green plants that cover lawns and fields.
seed|🌱|A tiny thing that grows into a plant.
forest|🌲|A big area full of trees.
storm|⛈️|Strong wind with rain and thunder.
rainbow|🌈|Colorful arcs in the sky after rain.
volcano|🌋|A mountain that can erupt with lava.
island|🏝️|Land with water all around it.
desert|🏜️|A dry, sandy place with little rain.
cave|🕳️|A hollow space in rock or a hill.
pond|🦆|A small pool of still water.
wave|🌊|Moving water that rolls onto the shore.
fog|🌫️|A cloud near the ground.
ice|🧊|Frozen water.
mud|🟫|Wet, sticky dirt.
bush|🌿|A short plant with many branches.
root|🌱|The part of a plant under the ground.
stone|🪨|A small piece of rock.
thunder|⚡|The loud boom after lightning.
beach|🏖️|Sandy land next to the sea.
valley|🏞️|Low land between hills.
meadow|🌼|A field of grass and wildflowers.
tulip|🌷|A cup-shaped spring flower.
daisy|🌼|A flower with white petals and a yellow middle.
cactus|🌵|A spiky plant that lives in the desert.
mushroom|🍄|A fungus with a cap and a stem.
shell|🐚|A hard outer cover from a sea animal.
acorn|🌰|The nut of an oak tree.
maple|🍁|A tree with star-shaped leaves.
frost|❄️|Thin ice on cold mornings.
spring|🌷|The season when flowers bloom.
summer|🌞|The warmest season of the year.
autumn|🍂|The season when leaves fall.
winter|⛄|The coldest season of the year.
lava|🌋|Hot melted rock from a volcano.
pebble|🪨|A small, smooth stone.
`,
  body: `
arm|💪|The part of your body between shoulder and hand.
leg|🦵|The part of your body you walk with.
ear|👂|What you use to hear sounds.
eye|👁️|What you use to see.
nose|👃|What you use to smell.
lip|👄|The soft edges of your mouth.
hand|✋|The part at the end of your arm.
foot|🦶|The part at the end of your leg.
head|🙂|The top part of your body.
hair|💇|Strands that grow on your head.
knee|🦵|The bendy middle of your leg.
neck|🦒|What joins your head to your body.
back|🧍|The rear part of your body.
chin|🙂|The bottom of your face.
cheek|😊|The side of your face below your eye.
tooth|🦷|A hard white part in your mouth for chewing.
teeth|😁|More than one tooth.
tongue|👅|What you taste with.
heart|❤️|It pumps blood all around your body.
brain|🧠|What you think with.
bone|🦴|A hard part inside your body.
skin|✋|The outside cover of your body.
thumb|👍|The short, thick finger.
finger|☝️|One of five on each hand.
elbow|💪|The bend in the middle of your arm.
wrist|⌚|Where your hand joins your arm.
ankle|🦶|Where your foot joins your leg.
toe|🦶|One of five on each foot.
mouth|👄|What you eat and talk with.
belly|🤰|Your tummy.
chest|🫁|The front of your body below your neck.
muscle|💪|It helps your body move and be strong.
lungs|🫁|They help you breathe air.
`,
  home: `
bed|🛏️|Where you sleep at night.
door|🚪|You open it to go in or out.
chair|🪑|A seat with a back.
table|🍽️|Furniture with a flat top.
lamp|💡|It gives light in a room.
sofa|🛋️|A soft seat for more than one person.
couch|🛋️|Another word for a sofa.
rug|🟥|A soft cover for the floor.
cup|☕|A small container to drink from.
bowl|🥣|A round dish for soup or cereal.
spoon|🥄|You eat soup with it.
fork|🍴|A tool with prongs for eating.
plate|🍽️|A flat dish for food.
sink|🚰|Where you wash dishes or hands.
bath|🛁|A tub to wash your whole body.
soap|🧼|It makes bubbles and gets you clean.
towel|🧺|A cloth to dry yourself.
clock|⏰|It tells the time.
window|🪟|Glass in a wall to see outside.
roof|🏠|The top cover of a house.
wall|🧱|One side of a room.
floor|🟫|What you stand on in a room.
key|🔑|It opens a lock.
broom|🧹|A brush to sweep the floor.
pillow|🛏️|A soft cushion for your head.
blanket|🛌|A warm cover for your bed.
mirror|🪞|Glass that shows your reflection.
oven|🔥|It gets hot to bake food.
kettle|🫖|It boils water.
house|🏠|A building where people live.
garden|🏡|A place where plants and flowers grow.
stairs|🪜|Steps that go up and down.
basket|🧺|A woven container for carrying things.
candle|🕯️|Wax with a wick that gives light.
teapot|🫖|A pot for making tea.
toy|🧸|Something fun to play with.
sponge|🧽|A soft thing that soaks up water.
bucket|🪣|A pail for carrying water.
`,
  school: `
book|📖|Pages with words and pictures to read.
pen|🖊️|A tool for writing with ink.
pencil|✏️|A tool for writing that can be erased.
desk|🗄️|A table for working or writing.
chalk|🖍️|A soft stick for writing on boards.
ruler|📏|A straight tool for measuring.
paper|📄|Thin sheets for writing and drawing.
glue|🧴|Sticky stuff that holds things together.
crayon|🖍️|A colorful wax stick for drawing.
eraser|🧽|It rubs out pencil marks.
class|🏫|A group of students learning together.
teacher|🧑‍🏫|A person who helps you learn.
lesson|📘|Time spent learning something.
math|➗|Learning about numbers and shapes.
read|📖|To look at words and understand them.
write|✍️|To put words on paper.
spell|🔤|To say or write the letters of a word.
test|📝|A way to show what you have learned.
bag|🎒|You carry your things in it.
map|🗺️|A drawing that shows where places are.
globe|🌍|A round model of the Earth.
paint|🎨|Colorful liquid used to make pictures.
music|🎵|Sounds put together in a pleasing way.
art|🎨|Making pictures and creative things.
letter|✉️|One of the symbols in the alphabet.
word|💬|A group of letters that means something.
story|📚|A tale about people or events.
bell|🔔|It rings to say class is starting.
friend|🤝|Someone you like to play with.
recess|🛝|Playtime during the school day.
library|📚|A place full of books to borrow.
number|🔢|A symbol that tells how many.
science|🔬|Learning how the world works.
school|🏫|A place where children learn.
student|🧑‍🎓|A person who is learning.
notebook|📓|A book of blank pages for notes.
backpack|🎒|A bag you wear on your back.
scissors|✂️|A tool for cutting paper.
`,
  space: `
moon|🌙|It shines in the night sky and circles Earth.
star|⭐|A giant ball of glowing gas far away.
planet|🪐|A big round world that circles a star.
comet|☄️|An icy rock with a glowing tail.
rocket|🚀|A vehicle that blasts off into space.
orbit|🛰️|The path something takes around a planet or star.
galaxy|🌌|A huge group of billions of stars.
alien|👽|A make-believe creature from another planet.
earth|🌍|The planet we live on.
mars|🔴|The red planet.
venus|🟡|The hottest planet, next to Earth.
saturn|🪐|The planet with beautiful rings.
meteor|☄️|A space rock that streaks across the sky.
crater|🌑|A round hole made by a space rock.
space|🌌|The huge area beyond Earth's sky.
shuttle|🚀|A spaceship that can fly back to Earth.
gravity|🍎|The pull that makes things fall down.
nebula|🌫️|A giant cloud of gas and dust in space.
lunar|🌙|Having to do with the Moon.
solar|☀️|Having to do with the Sun.
cosmos|✨|The whole universe.
launch|🚀|To send a rocket up into the sky.
jupiter|🟠|The biggest planet in our solar system.
mercury|⚫|The planet closest to the Sun.
neptune|🔵|A cold, windy blue planet.
uranus|🔵|An icy planet that spins on its side.
`,
};

const VALID = /^[a-z]{3,8}$/;

function parseTheme(text, theme) {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const [word, emoji, def] = line.split('|');
      return { word: word.trim().toLowerCase(), emoji: (emoji || '').trim(), def: (def || '').trim(), theme };
    })
    .filter((e) => VALID.test(e.word));
}

export const THEMES = {};
export const WORD_INFO = new Map();
for (const [theme, text] of Object.entries(THEME_DATA)) {
  THEMES[theme] = parseTheme(text, theme);
  for (const entry of THEMES[theme]) {
    if (!WORD_INFO.has(entry.word)) WORD_INFO.set(entry.word, entry);
  }
}

export const THEME_LABELS = {
  animals: 'Animals',
  food: 'Fruits & Food',
  nature: 'Nature',
  body: 'Body',
  home: 'Home',
  school: 'School',
  space: 'Space',
};

const all = new Set();
for (const w of GENERAL.split(/\s+/)) {
  const word = w.trim().toLowerCase();
  if (VALID.test(word)) all.add(word);
}
for (const word of WORD_INFO.keys()) all.add(word);

// Simple Words mode: very short starter words (2 and 3 letters) for early readers.
const SIMPLE = `
am an as at be by do go he if in is it me my no of on or ox so to up us we ok
cat bat rat hat fan man can bed red pen hen ten net pin win sit pig dog hot pot sun run cup bus
`;

/** Simple Words mode list (2–3 letters), sorted. */
export const SIMPLE_WORDS = [...new Set(SIMPLE.split(/\s+/).map((w) => w.trim().toLowerCase()).filter((w) => /^[a-z]{2,3}$/.test(w)))].sort();

// The 3-letter simple words are also playable in every other word mode.
for (const word of SIMPLE_WORDS) if (VALID.test(word)) all.add(word);

/** Every playable word, sorted. */
export const WORDS = [...all].sort();

/** Every word that can show up in the Dictionary (main list + 2-letter simple words). */
export const DICTIONARY_WORDS = [...new Set([...WORDS, ...SIMPLE_WORDS])].sort();

/** Kids / Learn mode: 3–5 letter words only. */
export const KIDS_WORDS = WORDS.filter((w) => w.length <= 5);

/** Tiny list used by the interactive tutorial so ✓ appears after three letters. */
export const TUTORIAL_WORDS = ['cat', 'dog', 'sun', 'hat', 'bus', 'cup', 'pig', 'map', 'fox', 'bee'];

export function getWordInfo(word) {
  return WORD_INFO.get(word) || null;
}
