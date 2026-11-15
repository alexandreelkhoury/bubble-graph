# Fact-check of the live Bluff! packs (2026-11), full pass

Scope: every item of `bluff-year-facts`, `bluff-odd-facts`, `bluff-me-facts`, `bluff-world-facts` (224 checked, 222 remain). Supersedes the first pass (9bbe372), which web-searched only the doubtful items.
Method: each item was checked against a live web source (search snippet or fetched page); the answer, every fake answer, the FR/AR/ES translations and the hedging of legends/etymologies were reviewed. `review.source` of every item reads `[VERIFY] fact-checked 2026-11, <url>`; all items stay `draft`.

## Totals

| Checked | Confirmed (unchanged) | Fixed | Hedged | Deleted | Items whose original fakes were true/arguable |
|---|---|---|---|---|---|
| 224 | 164 | 32 | 26 | 2 | 17 |

Locale minimum still met: 222 facts per locale (min 200).

## Known limits of this pass

- The WebSearch budget (200 calls per turn, shared by all agents) ran out partway through. The remaining items were checked by fetching Wikipedia raw text, PubMed/Europe PMC and a few publisher pages directly. This affects mostly wf-012 onward (world pack, several rest on Wikipedia alone: Elephant, Emperor penguin, Snail, Eiffel Tower, Lightning, Cat senses, Bull) and of-053 to of-060 (re-checked afterwards against Wikipedia).
- Weak sources, worth a human re-check: of-002 (scuba.com blog), of-024 (USDA kids sheet), of-031 (greekcitytimes.com), of-054 (octothorpe: fakes not re-checked against the full name list), of-056 (Frisbee pie tins: hedged "said to have", no new source this pass), me-077 (3,557 kg tabbouleh: single Daily Star report).
- Post-fix lint: five notes shortened to the 140-character limit (yf-034, of-001, of-058, me-059 in FR/ES), wf-017 ES fake "Mil años", of-002 first fake changed to Arms in 4 languages (the AR "mouth" fake was too close to the answer).
- wf-009 (Australia wider than the Moon) is true only by about 500 km (Snopes: "true, but not by much"); kept.
- Still doubtful but kept, as in the first pass: yf-034 ("first" potato in space), of-003, of-058, of-060.

## Changed or deleted items

| id | answer | status | what changed |
|---|---|---|---|
| yf-005 | Pablo Picasso | FIXED | note said painting came back in 1913; it was found Dec 1913 and returned to the Louvre Jan 1914 |
| yf-013 | Bat people | FIXED | note said the hoax ran for weeks; the serial ran six days (25-31 Aug 1835), now "series ran six days" in 4 languages |
| yf-014 | Peach baskets | FIXED | note claimed someone climbed up to get the ball (unsupported); now says baskets had bottoms so ball was fished out by hand |
| yf-019 | Submarine | HEDGED | note stated "they confessed in 1994" as fact; now "according to a confession revealed in 1994" (contested account) |
| yf-023 | Rooster | FIXED | note said all landed safely, but the rooster reportedly hurt a wing; now "all three survived (rooster hurt a wing)" |
| yf-025 | Jupiter | HEDGED | note: scar size hedged (roughly Earth-wide; sources differ) |
| yf-028 | Bakery | FIXED | note: dropped 'king's baker' (Farriner was a navy bread supplier; sources dispute title) |
| yf-029 | Tulip bulb | HEDGED | prompt+note hedged (reportedly; historians say house-price story exaggerated) |
| yf-032 | Rivets | HEDGED | note hedged: Davis origin story contested ('reportedly') |
| yf-033 | Prehistoric cave paintings | HEDGED | prompt hedged (dog story disputed) + note (age estimates vary) |
| yf-034 | Space | HEDGED | prompt hedged ('hailed as first'; earlier space potato claims) + note |
| yf-035 | 4 in the morning | HEDGED | note: removed unverified 'never patented' -> built for own use |
| yf-041 | Zoo | FIXED | note: 18s -> under 20s (Wikipedia 19s, news 18s) |
| yf-042 | 20 seconds | FIXED | note: removed unsourced 'truly inexcusable' quote |
| yf-043 | Copper brown | HEDGED | note: 'about 30 years' -> 'a few decades' (sources 20-30) |
| of-001 | Flamboyance | HEDGED | note now says popular name, scientists say flock |
| of-002 | Blood | FIXED | fakes Bones/Eyes (eyespots, ossicles) arguable and Squelette/Lingua; now Arms, Stomach, Skin (source weak, fetch+search budget out) |
| of-003 | Backwards | FIXED | fake Upside down arguable (replaced with Without flapping); note hedged (other birds briefly reverse) |
| of-005 | Laugh | FIXED | fake Purr arguable (rat bruxing) now Cry; note hedged as researchers think play laughter |
| of-013 | Eye | FIXED | es note said half head instead of half brain |
| of-018 | Berry | FIXED | fake Herb arguable (banana plant is a giant herb) replaced with Drupe |
| of-019 | Austria | HEDGED | note: traditionally credited to August Zang, 1838-1839 (sources vary) |
| of-020 | Mexico | HEDGED | note hedged: credited to Cardini per family, others dispute |
| of-021 | Canada | HEDGED | note: credited to Panopoulos (claim disputed) |
| of-022 | Ignacio Anaya | HEDGED | note: by the usual account (restaurant details vary) |
| of-023 | Money | FIXED | fake Medicine true (cacao medicinal), Dice dubious; now Candles, Paint; note corrected prices (rabbit 10-30 beans, turkey hen ~100) |
| of-026 | Horseradish | FIXED | fake Mint paste arguable (peppermint colouring reported); now Pistachio paste (en/ar/es) |
| of-028 | Chewing gum | FIXED | fake Fireworks arguable (Singapore restricts fireworks) now Bubble tea; note adds 2004 medical gum exception |
| of-029 | Pigeons | FIXED | fake Seagulls arguable (later fines for feeding gulls) now Peacocks |
| of-033 | On loan | FIXED | fake Fed daily/Nourris/Regalados arguable (pandas are fed; gifts historic) -> Sold in 4 langs |
| of-042 | Russia | FIXED | fact false: Pluto surface ~17.7M km2 > Russia 17.1M; inverted to Pluto about as big as country ___ = Russia, new fakes Canada/China/Brazil |
| of-047 | Seared steak | HEDGED | prompt now some astronauts say; note: descriptions vary (hot metal, welding fumes) |
| of-051 | Play well | HEDGED | note: LEGO says name in documents 1936; in 1934 replaced by in the 1930s |
| of-054 | Octothorpe | FIXED | removed official overclaim from prompt; fake Crosshatch tile/Croisillon carre too close to real names -> Quadrille; facts not live-verified / Wikipedia Number sign has an octothorp section; Bell Labs origin hedged; fakes not re-checked against name list (fetch timed out) |
| of-056 | Pies | HEDGED | note hedged said to have in 4 langs; fact not live-verified |
| of-058 | Mpemba | HEDGED | Wikipedia (fetched raw): named for Erasto Mpemba 1963; hedge from first pass |
| me-003 | Sea snails | FIXED | note said "few grams" from thousands of snails and AR/EN claimed "worth more than gold"; now ~10,000 snails per gram, gold claim dropped |
| me-007 | 10 tonnes | FIXED | "over ___" made fakes Two tonnes/500 kilos technically true; prompt now "about ___" in 4 langs; note gives Guinness 10,452 kg and ~300 student chefs |
| me-008 | The Ottoman Empire | HEDGED | etymology note hedged ("is thought to come from"/"غالبًا") in EN and AR; FR/ES already hedged |
| me-012 | 400 metres | FIXED | "more than ___" made fakes Fifty/A hundred metres technically true; prompt now "about ___" in 4 langs (actual ~430 m) |
| me-024 | Commander | HEDGED | note hedged ("probably", origin debated) in 4 langs |
| me-026 | Resin | FIXED | EN truth "Sap" is botanically imprecise (frankincense is hardened resin); EN truth now Resin with Sap/Gum as alts; FR/ES/AR already resin |
| me-042 | Damascus | FIXED | note overclaimed that Damascus weavers made damask famous (fabric probably not originated there); reworded to name meaning cloth from Damascus |
| me-045 | Desert | HEDGED | only-country-without-desert claim lacks authoritative source; prompt now says often said to be; note says no true desert |
| me-059 | Stews | FIXED | note said some 25 dishes but tablets hold dozens (25 is only the stew tablet YBC 4644); fake Bread was arguable since tablets include breads, replaced by Salads |
| me-065 | Moon landing | FIXED | fakes The last woolly mammoths (died ~2000 BC) and Stonehenge (c.3000-1500 BC) were arguably also closer to Cleopatra than the pyramid was; replaced by Invention of the wheel and First Sumerian cities |
| wf-001 | Cubes | HEDGED | note hedged (purpose of cube shape is a hypothesis) |
| wf-005 | Aztec | FIXED | fake Persian replaced by Egyptian (Safavid Persian Empire, 1501, is younger than Oxford, so arguably true) |
| wf-006 | Feet | FIXED | fr fake Ecailles aligned to Tails (queue) like en/ar/es |
| wf-007 | Forced labour | FIXED | note: word was suggested by Josef Capek and popularised by the play, not coined for it; fr fake aligned to Tin man |
| wf-012 | Human ones | HEDGED | note hedged: claim rests on one study (Wikipedia Fingerprint) |
| wf-013 | Bread | FIXED | fakes Candle wax and Sand replaced (wax tablets and sandstone/pumice were also used to erase marks, so arguably true); 1770 hedged |
| wf-014 | 15 centimetres | DELETED | no reliable source for 15 cm height growth: fact-check says the 15 cm figure is sideways sway, official source unreachable (403) |
| wf-017 | 165 Earth years | FIXED | fr/es third fake aligned to en/ar (a thousand years; was "un siècle") |
| wf-020 | Purple | HEDGED | note hedged: dates and origin of orange carrots vary by source |
| wf-026 | Chocolate bar | HEDGED | prompt/note hedged ("according to legend", Wikipedia says candy bar); es fake list aligned to en (Una pastilla de jabon -> Un helado) |
| wf-027 | Eleven | HEDGED | prompt/note hedged: age 11 and 1905 are Epperson's own claim |
| wf-031 | Radioactive | FIXED | fake Magnetic replaced (all matter, bananas included, is very weakly diamagnetic, so arguably true) |
| wf-038 | Two years | HEDGED | prompt now "up to" (NC State: at least 24 months by slowest method; Wikipedia says a plant matures within about a year) |
| wf-042 | Head | DELETED | no reliable source found for heart location; "shell" fake arguably true (heart lies under the carapace); popular "head" is really the fused cephalothorax |

## Full table (every item)

| id | answer | status | source | fakes OK |
|---|---|---|---|---|
| yf-001 | Emus | CONFIRMED | https://www.britannica.com/topic/Emu-War | yes |
| yf-002 | Dancing | CONFIRMED | https://publicdomainreview.org/essay/the-dancing-plague-of-1518/ | yes |
| yf-003 | Molasses | CONFIRMED | https://britannica.com/topic/Great-Molasses-Flood | yes |
| yf-004 | Laughter | CONFIRMED | https://en.wikipedia.org/wiki/Tanganyika_laughter_epidemic | yes |
| yf-005 | Pablo Picasso | FIXED | https://en.wikipedia.org/wiki/Vincenzo_Peruggia | yes |
| yf-006 | Trees | CONFIRMED | https://en.wikipedia.org/wiki/Spaghetti-tree_hoax | yes |
| yf-007 | Golf | CONFIRMED | https://www.astronomy.com/observing/alan-shepard-smacked-golf-balls-on-the-moon-and-now-we-know-where-they-landed/ | yes |
| yf-008 | Coffin | CONFIRMED | https://www.historytoday.com/archive/charlie-chaplin%E2%80%99s-coffin-stolen | yes |
| yf-009 | A dog | CONFIRMED | https://en.wikipedia.org/wiki/1966_theft_of_the_Jules_Rimet_Trophy | yes |
| yf-010 | 12 seconds | CONFIRMED | https://www.nps.gov/wrbr/learn/historyculture/thefirstflight.htm | yes |
| yf-011 | Art | CONFIRMED | https://en.wikipedia.org/wiki/Art_competitions_at_the_Summer_Olympics | yes |
| yf-012 | Car | CONFIRMED | https://en.wikipedia.org/wiki/Athletics_at_the_1904_Summer_Olympics_%E2%80%93_Men%27s_marathon | yes |
| yf-013 | Bat people | FIXED | https://hoaxes.org/archive/permalink/the_great_moon_hoax | yes |
| yf-014 | Peach baskets | FIXED | https://en.wikipedia.org/wiki/History_of_basketball | yes |
| yf-015 | An 11-year-old girl | CONFIRMED | https://en.wikipedia.org/wiki/Venetia_Burney | yes |
| yf-016 | Wow | CONFIRMED | https://en.wikipedia.org/wiki/Wow!_signal | yes |
| yf-017 | Moth | CONFIRMED | https://www.si.edu/object/log-book-computer-bug:nmah_334663 | yes |
| yf-018 | Rock | CONFIRMED | https://money.cnn.com/2015/04/01/news/pet-rock-founder-gary-dahl-dead | yes |
| yf-019 | Submarine | HEDGED | https://hoaxes.org/photo_database/image/the_surgeons_photo/ | yes |
| yf-020 | Tennis | CONFIRMED | https://en.wikipedia.org/wiki/Tennis_for_Two | yes |
| yf-021 | Trees | CONFIRMED | https://www.britannica.com/event/Tunguska-event | yes |
| yf-022 | Summer | CONFIRMED | https://www.nps.gov/articles/000/1816-the-year-without-summer.htm | yes |
| yf-023 | Rooster | FIXED | https://www.guinnessworldrecords.com/world-records/first-living-creatures-to-take-flight-in-a-man-made-craft | yes |
| yf-024 | Batteries unplugged | CONFIRMED | https://en.wikipedia.org/wiki/Carrington_Event | yes |
| yf-025 | Jupiter | HEDGED | https://nssdc.gsfc.nasa.gov/planetary/comet.html | yes |
| yf-026 | South Africa | CONFIRMED | https://pmc.ncbi.nlm.nih.gov/articles/PMC4200566 | yes |
| yf-027 | Nobody | CONFIRMED | https://www.smithsonianmag.com/smart-news/an-abandoned-merchant-ship-was-discovered-floating-in-the-atlantic-in-1872-the-mystery-of-its-missing-crew-was-never-solved-180985547/ | yes |
| yf-028 | Bakery | FIXED | https://www.londonmuseum.org.uk/collections/london-stories/great-fire-of-london/ | yes |
| yf-029 | Tulip bulb | HEDGED | https://www.historytoday.com/node/54516 | yes |
| yf-030 | Steam | CONFIRMED | https://ltmuseum.co.uk/visit/museum-guide/worlds-first-underground | yes |
| yf-031 | Uruguay | CONFIRMED | https://en.wikipedia.org/wiki/1930_FIFA_World_Cup | yes |
| yf-032 | Rivets | HEDGED | https://www.si.edu/object/nmah_371609 | yes |
| yf-033 | Prehistoric cave paintings | HEDGED | https://en.wikipedia.org/wiki/Lascaux | yes |
| yf-034 | Space | HEDGED | https://www.pbs.org/wgbh/nova/article/spuds-crops-in-space | yes |
| yf-035 | 4 in the morning | HEDGED | https://en.wikipedia.org/wiki/Levi_Hutchins | yes |
| yf-036 | All correct | CONFIRMED | https://www.merriam-webster.com/wordplay/the-hilarious-history-of-ok-okay | yes |
| yf-037 | Dentist | CONFIRMED | https://en.wikipedia.org/wiki/Cotton_candy | yes |
| yf-038 | 11 days | CONFIRMED | https://www.npr.org/2024/01/28/1227217274/sleep-deprivation-record | yes |
| yf-039 | Coffee pot | CONFIRMED | https://en.wikipedia.org/wiki/Trojan_Room_coffee_pot | yes |
| yf-040 | Laser pointer | CONFIRMED | https://time.com/4018841/first-item-sold-listed-ebay/ | yes |
| yf-041 | Zoo | FIXED | https://en.wikipedia.org/wiki/Me_at_the_zoo | yes |
| yf-042 | 20 seconds | FIXED | https://time.com/5027150/tsukuba-express-early-departure-apology | yes |
| yf-043 | Copper brown | HEDGED | https://copper.org/about/pressreleases/2011/pr2011_June_28.php | yes |
| yf-044 | Clay soldiers | CONFIRMED | https://en.wikipedia.org/wiki/Terracotta_Army | yes |
| yf-045 | Free for everyone | CONFIRMED | https://www.home.cern/news/news/computing/twenty-years-free-open-web | yes |
| of-001 | Flamboyance | HEDGED | https://animals.howstuffworks.com/birds/what-is-a-group-of-flamingos-called.htm | yes |
| of-002 | Blood | FIXED | https://www.scuba.com/blog/explore-the-blue/5-cool-facts-echinoderms/ | no |
| of-003 | Backwards | FIXED | https://worldatlas.com/articles/which-is-the-only-bird-that-can-fly-backward.html | no |
| of-004 | Eyes | CONFIRMED | https://www.nationalgeographic.com/animals/article/how-owls-twist-heads-almost-360-degrees | yes |
| of-005 | Laugh | FIXED | https://www.scientificamerican.com/article/rats-laugh-but-not-like-human/ | no |
| of-006 | Faces | CONFIRMED | https://www.nbcnews.com/news/amp/wbna43570637 | yes |
| of-007 | Trees | CONFIRMED | https://www.livescience.com/animals/sharks/are-sharks-really-older-than-trees | yes |
| of-008 | Black | CONFIRMED | https://www.aquazoo.nl/en/more-over-ice-bear/skin-of-a-ice-bear | yes |
| of-009 | Dark blue | CONFIRMED | https://giraffeconservation.org/facts-about-giraffe/how-long-is-a-giraffes-tongue-what-color-is-it/ | yes |
| of-010 | Glows | CONFIRMED | https://www.sciencenews.org/article/platypus-glow-blue-green-ultraviolet-light-fluorescent-fur | yes |
| of-011 | Five | CONFIRMED | https://www.bbka.org.uk/six-legs-four-wings-five-eyes | yes |
| of-012 | Brain | CONFIRMED | https://www.guinnessworldrecords.com/world-records/516760-largest-eyes-for-a-land-animal | yes |
| of-013 | Eye | FIXED | https://www.livescience.com/44822-how-do-dolphins-sleep.html | yes |
| of-014 | Pebble | CONFIRMED | https://www.discoverwildlife.com/animal-facts/birds/why-do-penguins-give-stones-to-each-other | yes |
| of-015 | Skull | CONFIRMED | https://pmc.ncbi.nlm.nih.gov/articles/PMC5063634 | yes |
| of-016 | Bottom | CONFIRMED | https://www.livescience.com/can-turtles-breathe-through-butts/ | yes |
| of-017 | Beans | CONFIRMED | https://www.britannica.com/plant/peanut | yes |
| of-018 | Berry | FIXED | https://www.livescience.com/57477-why-are-bananas-considered-berries.html | no |
| of-019 | Austria | HEDGED | https://en.wikipedia.org/wiki/Croissant | yes |
| of-020 | Mexico | HEDGED | https://thepublicsradio.org/npr/hail-caesar-salad-born-100-years-ago-in-tijuana/ | yes |
| of-021 | Canada | HEDGED | https://thecanadianencyclopedia.ca/en/article/sam-panopolous | yes |
| of-022 | Ignacio Anaya | HEDGED | https://en.wikipedia.org/wiki/Nachos | yes |
| of-023 | Money | FIXED | https://www.worldhistory.org/Chocolate_in_Mesoamerica/ | no |
| of-024 | Air | CONFIRMED | https://webarchive.library.unt.edu/eot2008/20090109075824/http://content.fsa.usda.gov/fsakids/Zip_Color_Sheets/2apples.pdf | yes |
| of-025 | Fruit | CONFIRMED | https://www.mentalfloss.com/article/31226/cashew-nuts-grow-out-of-crazy-apples | yes |
| of-026 | Horseradish | FIXED | https://en.wikipedia.org/wiki/Wasabi | no |
| of-027 | Madagascar | CONFIRMED | https://verite.org/initiative/africa/commodities/vanilla/ | yes |
| of-028 | Chewing gum | FIXED | https://en.wikipedia.org/wiki/Chewing_gum_sales_ban_in_Singapore | no |
| of-029 | Pigeons | FIXED | https://www.nbcnews.com/id/wbna24390018 | no |
| of-030 | List | CONFIRMED | https://en.wikipedia.org/wiki/Naming_law | yes |
| of-031 | High heels | CONFIRMED | https://greekcitytimes.com/2025/02/12/important-notice-for-all-holidaymakers-new-rules-and-fines-in-greece-and-italy/ | yes |
| of-032 | Mute swans | CONFIRMED | https://www.royal.uk/swans | yes |
| of-033 | On loan | FIXED | https://www.scmp.com/news/china/diplomacy/article/3222175/how-has-chinas-panda-diplomacy-evolved-and-where-are-its-stars-now | no |
| of-034 | Private property | CONFIRMED | https://www.weforum.org/stories/nature-and-biodiversity/sweden-roam-freely-law-Allemansr%C3%A4tt-access-nature/ | yes |
| of-035 | Income | CONFIRMED | https://www.euronews.com/2023/01/04/finlands-progressive-punishment-when-it-comes-to-speeding-tickets | yes |
| of-036 | Civet | CONFIRMED | https://www.sciencefocus.com/nature/civet | yes |
| of-037 | 68 years | CONFIRMED | https://www.smithsonianmag.com/history/the-curious-case-of-charles-osborne-who-hiccuped-for-68-years-straight-180980232/ | yes |
| of-038 | Saint Helena | CONFIRMED | https://www.guinnessworldrecords.com/world-records/511806-oldest-living-land-animal | yes |
| of-039 | Antarctica | CONFIRMED | https://britannica.com/topic/worlds-largest-deserts-2225895 | yes |
| of-040 | Hawaii | CONFIRMED | https://www.guinnessworldrecords.com/world-records/tallest-mountain.html | yes |
| of-041 | Canada | CONFIRMED | https://www.snopes.com/fact-check/canada-lakes/ | yes |
| of-042 | Russia | FIXED | https://www.worldatlas.com/space/how-big-is-pluto.html | yes |
| of-043 | Atoms | CONFIRMED | https://mathworld.wolfram.com/ShannonNumber.html | yes |
| of-045 | Glass | CONFIRMED | https://www.nasa.gov/news-release/nasa-hubble-finds-a-true-blue-planet/ | yes |
| of-046 | Pale blue | CONFIRMED | https://chemed.chem.purdue.edu/genchem/demosheets/8.6.html | yes |
| of-047 | Seared steak | HEDGED | https://www.smithsonianmag.com/smart-news/what-does-space-smell-like-3457620/ | yes |
| of-048 | Blue | CONFIRMED | https://svs.gsfc.nasa.gov/11875 | yes |
| of-049 | Wallpaper | CONFIRMED | https://www.fox10phoenix.com/news/brief-history-play-doh | yes |
| of-050 | Denmark | CONFIRMED | https://gizmodo.com/bluetooth-is-named-after-a-medieval-king-who-may-have-h-1671450657 | yes |
| of-051 | Play well | HEDGED | https://www.lego.com/en-ae/aboutus/news/2026/february/90-year-history-of-the-lego-name | yes |
| of-052 | New York | CONFIRMED | https://www.atlasobscura.com/articles/haagen-dazs-fake-foreign-branding | yes |
| of-053 | Brad's Drink | CONFIRMED | https://en.wikipedia.org/wiki/Pepsi | yes |
| of-054 | Octothorpe | FIXED | https://en.wikipedia.org/wiki/Number_sign | yes |
| of-055 | Tittle | CONFIRMED | https://en.wikipedia.org/wiki/Tittle | yes |
| of-056 | Pies | HEDGED | NONE (budget exhausted; hedge only) | yes |
| of-057 | A Pringles can | CONFIRMED | https://en.wikipedia.org/wiki/Fredric_J._Baur | yes |
| of-058 | Mpemba | HEDGED | https://en.wikipedia.org/wiki/Mpemba_effect | yes |
| of-059 | 35 percent | CONFIRMED | https://en.wikipedia.org/wiki/Canadian_content | yes |
| of-060 | Kangaroos | CONFIRMED | https://en.wikipedia.org/wiki/Kangaroo | yes |
| me-001 | Byblos | CONFIRMED | https://www.historyofinformation.com/detail.php?id=1292 | yes |
| me-002 | Phoenicians | CONFIRMED | https://www.worldhistory.org/Greek_Alphabet/ | yes |
| me-003 | Sea snails | FIXED | https://phys.org/news/2020-07-passion-purple-revives-ancient-dye.pdf | yes |
| me-004 | Pregnant Woman | CONFIRMED | https://en.wikipedia.org/wiki/Baalbek_Stones | yes |
| me-005 | Boat | CONFIRMED | https://showcaves.com/english/lb/showcaves/Jeita.html | yes |
| me-006 | New York | CONFIRMED | https://www.history.com/this-day-in-history/the-prophet-kahlil-gibran-published | yes |
| me-007 | 10 tonnes | FIXED | https://www.guinnessworldrecords.com/world-records/largest-serving-of-hummus | no |
| me-008 | The Ottoman Empire | HEDGED | https://en.wikipedia.org/wiki/Tulip | yes |
| me-009 | Yemen | CONFIRMED | https://www.smithsonianmag.com/smart-news/your-mocha-named-after-birthplace-coffee-trade-180965016/ | yes |
| me-010 | Restoration | CONFIRMED | https://www.etymonline.com/de/word/algebra | yes |
| me-011 | Baghdad | CONFIRMED | https://www.britannica.com/biography/al-Khwarizmi | yes |
| me-012 | 400 metres | FIXED | https://www.britannica.com/place/Dead-Sea | no |
| me-013 | Rose | CONFIRMED | https://en.wikipedia.org/wiki/Petra | yes |
| me-014 | Rivers | CONFIRMED | https://www.worldatlas.com/articles/are-there-any-rivers-in-saudi-arabia.html | yes |
| me-015 | Fat | CONFIRMED | https://www.britannica.com/story/do-camels-store-water-in-their-humps | yes |
| me-016 | India | CONFIRMED | https://en.wikipedia.org/wiki/Hindu%E2%80%93Arabic_numeral_system | yes |
| me-017 | Africa | CONFIRMED | https://www.livius.org/sources/content/herodotus/herodotus-on-the-first-circumnavigation-of-africa | yes |
| me-018 | Tyre | CONFIRMED | https://en.wikipedia.org/wiki/History_of_Carthage | yes |
| me-019 | Phoenicians | CONFIRMED | https://en.wikipedia.org/wiki/C%C3%A1diz | yes |
| me-020 | Tyre | CONFIRMED | https://en.wikipedia.org/wiki/Europa_(consort_of_Zeus) | yes |
| me-021 | The 8th century | CONFIRMED | https://whc.unesco.org/document/216483 | yes |
| me-022 | Journey | CONFIRMED | https://www.dictionary.com/browse/safaris | yes |
| me-023 | Storehouses | CONFIRMED | https://en.wiktionary.org/wiki/magasin | yes |
| me-024 | Commander | HEDGED | https://www.etymonline.com/word/admiral | yes |
| me-025 | Something thrown down | CONFIRMED | https://www.dictionary.com/browse/mattress | yes |
| me-026 | Resin | FIXED | https://www.khaleejtimes.com/world/mena/oman-efforts-to-preserve-frankincense-white-gold | yes |
| me-027 | Vulnerable | CONFIRMED | https://en.wikipedia.org/wiki/Arabian_oryx | yes |
| me-028 | Mars | CONFIRMED | https://en.wikipedia.org/wiki/Wadi_Rum | yes |
| me-029 | Wet clay | CONFIRMED | https://www.britannica.com/summary/cuneiform | yes |
| me-030 | Babylonians | CONFIRMED | https://www.livescience.com/44964-why-60-minutes-in-an-hour.html | yes |
| me-031 | Macedonian Greek | CONFIRMED | https://www.worldhistory.org/Cleopatra_VII/ | yes |
| me-032 | Soap | CONFIRMED | https://en.wikipedia.org/wiki/Audi_Soap_Museum | yes |
| me-033 | Phoenician | CONFIRMED | https://www.deseret.com/1999/12/1/19478200/phoenicians-credited-with-discovering-glass | yes |
| me-034 | White | CONFIRMED | https://en.wiktionary.org/wiki/Lebanon | yes |
| me-035 | Wells | CONFIRMED | https://en.wikipedia.org/wiki/Beirut | yes |
| me-036 | Lebanese cedar | CONFIRMED | https://en.wikipedia.org/wiki/Khufu_ship | yes |
| me-037 | Quarter | CONFIRMED | https://www.britannica.com/place/Rub-al-Khali | yes |
| me-038 | Penguins | CONFIRMED | https://thenationalnews.com/uae/2023/10/31/working-wonders-ski-dubais-penguin-trainer-on-why-its-her-dream-job | yes |
| me-039 | Goats | CONFIRMED | https://en.wikipedia.org/wiki/Kaldi | yes |
| me-040 | A woman | CONFIRMED | https://en.wikipedia.org/wiki/University_of_al-Qarawiyyin | yes |
| me-041 | Helpless | CONFIRMED | https://en.wikipedia.org/wiki/Checkmate | yes |
| me-042 | Damascus | FIXED | https://www.etymonline.com/word/Damascus | yes |
| me-043 | Laurel berries | CONFIRMED | https://en.wikipedia.org/wiki/Aleppo_soap | yes |
| me-044 | Rock | CONFIRMED | https://en.wikipedia.org/wiki/Raouch%C3%A9 | yes |
| me-045 | Desert | HEDGED | https://en.wikipedia.org/wiki/Geography_of_the_Arab_world | yes |
| me-046 | Space rockets | CONFIRMED | https://en.wikipedia.org/wiki/Cedar_rocket | yes |
| me-047 | Brasília | CONFIRMED | https://whc.unesco.org/en/news/2516 | yes |
| me-048 | Beirut | CONFIRMED | https://www.biography.com/actor/keanu-reeves | yes |
| me-049 | Brazil | CONFIRMED | https://en.wikipedia.org/wiki/Lebanese_Brazilians | yes |
| me-050 | Zajal | CONFIRMED | https://ich.unesco.org/en/RL/01000 | yes |
| me-051 | Deserts | CONFIRMED | https://www.britannica.com/question/How-did-the-Sahara-get-its-name | yes |
| me-052 | Eyelids | CONFIRMED | https://animals.sandiegozoo.org/animals/camel | yes |
| me-053 | Happiness | CONFIRMED | https://www.nbcnews.com/news/world/united-arab-emirates-names-official-minister-happiness-n516141 | yes |
| me-054 | Robot | CONFIRMED | https://weforum.org/agenda/2017/10/a-robot-has-just-been-granted-citizenship-of-saudi-arabia | yes |
| me-055 | Gold bars | CONFIRMED | https://www.thenationalnews.com/business/travel-and-tourism/emirates-palace-atm-worth-its-weight-in-gold-1.413371 | yes |
| me-056 | Bugatti | CONFIRMED | https://www.automotive-fleet.com/116774/bugatti-veyron-joins-dubai-police-fleet | yes |
| me-057 | Mud brick | CONFIRMED | https://whc.unesco.org/en/list/192 | yes |
| me-058 | Tunisia | CONFIRMED | https://en.wikipedia.org/wiki/Tatooine | yes |
| me-059 | Stews | FIXED | https://en.wikipedia.org/wiki/Yale_culinary_tablets | no |
| me-060 | Clock | CONFIRMED | https://libapps.luc.edu/digitalexhibits/s/honr212/page/morganc2 | yes |
| me-061 | Feathered wings | CONFIRMED | https://en.wikipedia.org/wiki/Abbas_ibn_Firnas | yes |
| me-062 | Enters the eye | CONFIRMED | https://www.sciencenews.org/blog/context/islamic-science-paved-way-millennial-celebration-light | yes |
| me-063 | 30 years | CONFIRMED | https://archive.aramcoworld.com/issue/196107/ibn.battuta.traveler.from.tangier.htm | yes |
| me-064 | 3,800 years | CONFIRMED | https://www.historyrevealed.com/feature/what-overtook-the-great-pyramid-of-giza-as-the-tallest-manmade-structure/ | yes |
| me-065 | Moon landing | FIXED | https://www.worldatlas.com/articles/so-cleopatra-lived-closer-in-time-to-the-first-lunar-landing-than-the-great-pyramids.html | no |
| me-066 | Wheat and barley | CONFIRMED | https://www.smithsonianmag.com/smart-news/egyptian-papyrus-reveals-old-wives-tale-very-very-old-indeed-180970066/ | yes |
| me-067 | Eyebrows | CONFIRMED | https://lexundria.com/hdt/2.66/mcly | yes |
| me-068 | Hieroglyphs | CONFIRMED | https://www.history.co.uk/this-day-in-history/19-july/the-rosetta-stone-is-discovered | yes |
| me-069 | Ribs | CONFIRMED | https://en.wikipedia.org/wiki/Arabian_horse | yes |
| me-070 | Empty | CONFIRMED | https://mathshistory.st-andrews.ac.uk/Miller/mathword/z/ | yes |
| me-071 | Sunset | CONFIRMED | https://sepwww.stanford.edu/sep/jon/sunset.pdf | yes |
| me-072 | Resin | CONFIRMED | https://www.mdpi.com/2223-7747/7/4/91 | yes |
| me-073 | Botox | CONFIRMED | https://www.npr.org/sections/thetwo-way/2018/01/24/580228837/a-dozen-camels-disqualified-from-saudi-beauty-pageant-over-botox-injections | yes |
| me-074 | Robots | CONFIRMED | https://www.gulf-times.com/article/717541/qatar/robot-jockeys-take-the-reins-at-qatars-camel-racing-season | yes |
| me-075 | Goats | CONFIRMED | https://www.nationalgeographic.com/animals/article/moroccos-tree-climbing-goats | yes |
| me-076 | Solid silver | CONFIRMED | https://factumfoundation.org/our-projects/digital-restorations/re-creating-the-lost-map-of-al-idrisi/al-idrisi-and-roger-ii-mapping-the-world-in-the-twelfth-century/ | yes |
| me-077 | 3.5 tonnes | CONFIRMED | https://www.zawya.com/en/business/lebanon-breaks-hummus-tabbouleh-guinness-record-eyfqhw7j | yes |
| wf-001 | Cubes | HEDGED | https://www.livescience.com/why-wombats-have-cubed-poop.html | yes |
| wf-002 | Three | CONFIRMED | https://www.discoverwildlife.com/animal-facts/marine-animals/octopuses-have-three-hearts | yes |
| wf-003 | Unicorn | CONFIRMED | https://www.historic-uk.com/HistoryUK/HistoryofScotland/The-Unicorn-Scotlands-National-Animal | yes |
| wf-004 | Year | CONFIRMED | https://spaceplace.nasa.gov/all-about-venus/ | yes |
| wf-005 | Aztec | FIXED | https://www.ox.ac.uk/about/organisation/history | no |
| wf-006 | Feet | FIXED | https://carleton.ca/biology/cu-faq/do-butterflies-really-taste-through-their-feet/ | yes |
| wf-007 | Forced labour | FIXED | https://www.npr.org/transcripts/135634400 | yes |
| wf-008 | Eleven | CONFIRMED | https://www.historytoday.com/archive/gregorian-calendar-adopted-england | yes |
| wf-009 | Moon | CONFIRMED | https://www.snopes.com/fact-check/australia-wider-than-earths-moon/ | yes |
| wf-010 | Wallpaper | CONFIRMED | https://www.smithsonianmag.com/innovation/accidental-invention-bubble-wrap-180971325/ | yes |
| wf-011 | Hands | CONFIRMED | https://discovermagazine.com/planet-earth/sea-otters-hold-hands-while-sleeping-and-they-even-cuddle | yes |
| wf-012 | Human ones | HEDGED | https://en.wikipedia.org/wiki/Fingerprint | yes |
| wf-013 | Bread | FIXED | https://en.wikipedia.org/wiki/Eraser | no |
| wf-014 | 15 centimetres | DELETED | https://www.yahoo.com/news/fact-check-eiffel-tower-grows-120000751.html | yes |
| wf-015 | What they eat | CONFIRMED | https://riverbanks.org/animals/birds/american-flamingo | yes |
| wf-016 | West | CONFIRMED | https://starchild.gsfc.nasa.gov/docs/StarChild/solar_system_level2/venus_answer.html | yes |
| wf-017 | 165 Earth years | FIXED | https://www.britannica.com/place/Neptune-planet/Basic-astronomical-data | yes |
| wf-018 | Playing cards | CONFIRMED | https://en.wikipedia.org/wiki/Nintendo | yes |
| wf-019 | Indigestion | CONFIRMED | https://www.atlasobscura.com/articles/tomato-pill | yes |
| wf-020 | Purple | HEDGED | https://www.alimentarium.org/en/node/1122 | yes |
| wf-021 | Under two minutes | CONFIRMED | https://en.wikipedia.org/wiki/Westray_to_Papa_Westray_flight | yes |
| wf-022 | Water | CONFIRMED | https://solarsystem.nasa.gov/saturn-by-the-numbers/ | yes |
| wf-023 | Guinea pig | CONFIRMED | https://www.swissinfo.ch/eng/loo-flushing--explosives---gold_fact-check--lonely-guinea-pigs-and-other-quirky-swiss-rumours/45067078 | yes |
| wf-024 | Outer space | CONFIRMED | https://en.wikipedia.org/wiki/Tardigrades_in_space | yes |
| wf-025 | Burrs | CONFIRMED | https://en.wikipedia.org/wiki/George_de_Mestral | yes |
| wf-026 | Chocolate bar | HEDGED | https://en.wikipedia.org/wiki/Percy_Spencer | yes |
| wf-027 | Eleven | HEDGED | https://en.wikipedia.org/wiki/Ice_pop | yes |
| wf-028 | Sweetness | CONFIRMED | https://en.wikipedia.org/wiki/Cat_senses | yes |
| wf-029 | Human faces | CONFIRMED | https://pubmed.ncbi.nlm.nih.gov/16326952/ | yes |
| wf-030 | Red | CONFIRMED | https://en.wikipedia.org/wiki/Hippopotamus | yes |
| wf-031 | Radioactive | FIXED | https://en.wikipedia.org/wiki/Banana_equivalent_dose | no |
| wf-032 | Centimetres | CONFIRMED | https://en.wikipedia.org/wiki/Orbit_of_the_Moon | yes |
| wf-033 | Eleven | CONFIRMED | https://en.wikipedia.org/wiki/Time_in_Russia | yes |
| wf-034 | France | CONFIRMED | https://en.wikipedia.org/wiki/List_of_time_zones_by_country | yes |
| wf-035 | Mosquito | CONFIRMED | https://en.wikipedia.org/wiki/Culiseta_annulata | yes |
| wf-036 | Movement | CONFIRMED | https://en.wikipedia.org/wiki/Bull | yes |
| wf-038 | Two years | HEDGED | https://plants.ces.ncsu.edu/plants/ananas-comosus/ | yes |
| wf-039 | The surface of the Sun | CONFIRMED | https://en.wikipedia.org/wiki/Lightning | yes |
| wf-040 | Jump | CONFIRMED | https://en.wikipedia.org/wiki/Elephant | yes |
| wf-041 | Feet | CONFIRMED | https://en.wikipedia.org/wiki/Emperor_penguin | yes |
| wf-042 | Head | DELETED | https://en.wikipedia.org/wiki/Shrimp | no |
| wf-043 | Teeth | CONFIRMED | https://en.wikipedia.org/wiki/Snail | yes |
| wf-044 | Twenty years | CONFIRMED | https://en.wikipedia.org/wiki/Eiffel_Tower | yes |
