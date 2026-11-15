# Fact-check: Quiz Night (trivia), 2026-11 (full pass)

Live packs (content/trivia/index.ts): world-mix-01 (75 questions) and lb-quiz-01 (75 questions), each in EN/FR/AR/ES. This pass covered all 150 question ids, each with at least one live web search, a recorded URL, and a line-by-line comparison of the FR/AR/ES versions (question, option order, correct index, explanation) against EN.

Totals: 150 checked; 142 confirmed (unchanged); 8 fixed; 0 deleted; 0 ambiguous. Pack sizes unchanged (75 + 75).

Checks per question: (a) marked answer correct, (b) no second correct option, (c) explanation true, (d) time-sensitive wording, (e) FR/AR/ES parity. The `source` field of every question (all 4 languages) now holds the verified URL instead of "[VERIFY] ...". Draft flags unchanged.

## Changes
- world-mix q018: AR explanation was written in Levantine dialect inside the formal-MSA pack; rewritten in MSA (answer unchanged).
- world-mix q025: Empire State Building struck "around 20" times a year; NWS/NYC figure is about 25. Changed in EN/FR/AR/ES.
- world-mix q031: (earlier pass) Aldrin followed "about twenty minutes later"; re-verified against NASA.
- world-mix q038: "painted from memory" is disputed (MoMA: inspired by the view from his window); explanation reworded in all 4 languages.
- world-mix q045: ES explanation typo ("Une cante").
- lb q037: EN option said "double-reed"; the mijwiz is a double-pipe single-reed instrument. EN option now "The mijwiz (double pipe)"; FR/ES "flûte double"/"flauta double" kept.
- lb q044: Al-Ansar record count changes (16 titles as of 2025); question now states "as of 2025" in all 4 languages.
- lb q050: AR version asked "what do they put in kibbeh nayyeh" with different options; replaced with the EN-equivalent "how is it served" (fried/grilled/raw/baked; answer index 2).

## Caveats (honest notes)
- Sources were collected by six parallel batches of live searches; a per-turn cap of 200 searches was hit near the end. The last question of batch 3 (world-mix q075) was therefore verified by fetching Wikipedia (Machu Picchu, about 2,430 m, southern Peru) rather than searching, and lb q075 / lb q069 were settled by page fetch. UNESCO/MoMA pages that returned 403 were cited through search snippets.
- Weaker sources (fact true, publisher not ideal): world-mix q023 (cornea), q029 (Leonardo flying machines not separately sourced), q053 (Brazil 5 titles: Britannica page only; Spain won 2026, Brazil still holds the most, 5), q057, q071, q073, q074; lb q022 (trilingual greeting is a cultural statement, not quotable), q029, q035, q048, q071.
- Left as is on purpose: world-mix q010 (Angel Falls "tallest waterfall": Tugela Falls is not an option; could say "uninterrupted"), q014 (diamond as hardest natural material, standard answer), lb q057 (Tyre hippodrome "around 20,000": estimates run 20,000-40,000), lb q074 (Maatouk top scorer, stable after his 2024 retirement), lb q060 (Shouf holds about 25 % of remaining cedars per IUCN).

## All 150 questions
| id | answer (EN) | status | URL |
|---|---|---|---|
| world-mix-01 q001 | The Pacific | CONFIRMED | https://www.britannica.com/summary/Pacific-Ocean |
| world-mix-01 q002 | Russia | CONFIRMED | https://en.wikipedia.org/wiki/Area_of_Russia |
| world-mix-01 q003 | Canberra | CONFIRMED | https://australiangeographic.com.au/?p=21733 |
| world-mix-01 q004 | The Sahara | CONFIRMED | https://www.guinnessworldrecords.com/world-records/largest-desert |
| world-mix-01 q005 | France | CONFIRMED | https://www.timeanddate.com/time/country-with-the-most-time-zones.html |
| world-mix-01 q006 | True | CONFIRMED | https://www.snopes.com/fact-check/one-day-on-venus-is-longer-than-a-year-on-venus/ |
| world-mix-01 q007 | Vatican City | CONFIRMED | https://www.britannica.com/topic/list-of-the-smallest-countries-by-area |
| world-mix-01 q008 | Italy | CONFIRMED | https://www.esa.int/Applications/Observing_the_Earth/Earth_from_Space_The_Boot |
| world-mix-01 q009 | South Africa | CONFIRMED | https://www.worldatlas.com/articles/what-is-the-capital-of-south-africa.html |
| world-mix-01 q010 | Angel Falls | CONFIRMED | https://en.wikipedia.org/wiki/Angel_Falls |
| world-mix-01 q011 | Antarctica | CONFIRMED | https://www.pestworld.org/news-hub/pest-articles/8-interesting-facts-about-ants/ |
| world-mix-01 q012 | Carbon dioxide | CONFIRMED | https://www.livescience.com/51720-photosynthesis.html |
| world-mix-01 q013 | 8 | CONFIRMED | https://www.newworldencyclopedia.org/entry/Arachnida |
| world-mix-01 q014 | Diamond | CONFIRMED | https://www.livescience.com/planet-earth/geology/is-anything-harder-than-a-diamond |
| world-mix-01 q015 | Jupiter | CONFIRMED | https://www.jpl.nasa.gov/images/pia21774-jupiters-great-red-spot-swallows-earth/ |
| world-mix-01 q016 | Uranus | CONFIRMED | https://science.gsfc.nasa.gov/690/Uranus.html |
| world-mix-01 q017 | True | CONFIRMED | https://www.pbs.org/wnet/nature/group/mammals/bat |
| world-mix-01 q018 | The blue whale | FIXED (AR explanation was Levantine dialect in the MSA pack; now MSA) | https://www.guinnessworldrecords.com/world-records/largest-heart |
| world-mix-01 q019 | Three | CONFIRMED | https://www.livescience.com/how-many-hearts-does-an-octopus-have |
| world-mix-01 q020 | Mercury | CONFIRMED | https://www.britannica.com/science/mercury-chemical-element |
| world-mix-01 q021 | Au | CONFIRMED | https://en.wikipedia.org/wiki/Gold |
| world-mix-01 q022 | Brazil | CONFIRMED | https://www.aljazeera.com/news/2023/10/1/international-coffee-day-where-does-your-caffeine-fix-come-from |
| world-mix-01 q023 | The cornea | CONFIRMED | https://kolibri.teacherinabox.org.au/modules/en-wikipedia_for_schools-static/wp/c/Cornea.htm |
| world-mix-01 q024 | True | CONFIRMED | https://en.wikipedia.org/wiki/Speed_of_sound |
| world-mix-01 q025 | False | FIXED (explanation "around 20" -> "about 25" strikes/year, all 4 languages) | https://www.nyc.gov/site/em/ready/thunderstorms.page |
| world-mix-01 q026 | The koala | CONFIRMED | https://www.pbs.org/wgbh/nova/article/koala-fingerprints |
| world-mix-01 q027 | The Sun | CONFIRMED | https://science.nasa.gov/?p=465403 |
| world-mix-01 q028 | The Great Pyramid of Giza | CONFIRMED | https://education.nationalgeographic.org/resource/seven-wonders-ancient-world/ |
| world-mix-01 q029 | Leonardo da Vinci | CONFIRMED | https://www.britannica.com/question/Where-is-the-real-Mona-Lisa-kept |
| world-mix-01 q030 | Paris | CONFIRMED | https://www.britannica.com/question/Where-is-the-real-Mona-Lisa-kept |
| world-mix-01 q031 | Neil Armstrong | FIXED (previous pass: "about twenty minutes later", all 4); re-verified | https://www.nasa.gov/feature/50-years-ago-one-small-step-one-giant-leap |
| world-mix-01 q032 | 1969 | CONFIRMED | https://www.nasa.gov/feature/50-years-ago-apollo-astronauts-land-take-first-us-steps-on-moon |
| world-mix-01 q033 | Johannes Gutenberg | CONFIRMED | https://www.britannica.com/biography/Johannes-Gutenberg |
| world-mix-01 q034 | Pompeii | CONFIRMED | https://www.smithsonianmag.com/travel/a-glimpse-of-old-pompeii-10918623/ |
| world-mix-01 q035 | Tim Berners-Lee | CONFIRMED | https://timeline.web.cern.ch/node/365 |
| world-mix-01 q036 | Al-Khwarizmi | CONFIRMED | https://www.britannica.com/biography/al-Khwarizmi |
| world-mix-01 q037 | Arabic | CONFIRMED | https://en.wiktionary.org/wiki/coffee |
| world-mix-01 q038 | Vincent van Gogh | FIXED ("from memory" disputed -> "inspired by the view from his window", all 4) | https://www.britannica.com/topic/The-Starry-Night |
| world-mix-01 q039 | Mexico | CONFIRMED | https://www.mexicocity.cdmx.gob.mx/venues/frida-kahlo-museum-casa-azul/ |
| world-mix-01 q040 | Salvador Dalí | CONFIRMED | https://www.britannica.com/topic/The-Persistence-of-Memory |
| world-mix-01 q041 | 88 | CONFIRMED | https://www.gear4music.com/blog/piano-notes/ |
| world-mix-01 q042 | Beethoven | CONFIRMED | https://www.britannica.com/print/article/578114 |
| world-mix-01 q043 | 6 | CONFIRMED | https://www.britannica.com/art/bass-guitar |
| world-mix-01 q044 | Uruguay | CONFIRMED | https://ich.unesco.org/en/RL/00258 |
| world-mix-01 q045 | Andalusia | FIXED (ES explanation typo "Une cante" -> "Une el cante") | https://ich.unesco.org/es/RL/el-flamenco-00363 |
| world-mix-01 q046 | South Korea | CONFIRMED | https://www.korea.net/NewsFocus/Culture/view?articleId=188978 |
| world-mix-01 q047 | Mufasa | CONFIRMED | https://d23.com/disney-a-to-z/lion-king-the-film |
| world-mix-01 q048 | Steven Spielberg | CONFIRMED | https://www.britannica.com/topic/Jurassic-Park-film-by-Spielberg |
| world-mix-01 q049 | Bombay | CONFIRMED | https://en.wikipedia.org/wiki/Bollywood |
| world-mix-01 q050 | Snow White and the Seven Dwarfs | CONFIRMED | https://www.britannica.com/topic/Snow-White-and-the-Seven-Dwarfs-film-1937 |
| world-mix-01 q051 | Parasite | CONFIRMED | https://www.pbs.org/newshour/arts/parasite-becomes-first-non-english-language-film-to-win-best-picture-oscar |
| world-mix-01 q052 | 11 | CONFIRMED | https://www.thefa.com/football-rules-governance/lawsandrules/laws/football-11-11/law-3---the-players |
| world-mix-01 q053 | Brazil | CONFIRMED | https://www.britannica.com/sports/football-soccer |
| world-mix-01 q054 | Uruguay | CONFIRMED | https://olympics.com/en/news/first-fifa-world-cup-football-1930-uruguay-champion-records |
| world-mix-01 q055 | Argentina | CONFIRMED | https://www.aljazeera.com/sports/2022/12/18/messis-argentina-beat-france-on-penalties-to-win-world-cup |
| world-mix-01 q056 | Morocco | CONFIRMED | https://egyptianstreets.com/2022/12/10/morocco-first-african-arab-nation-to-reach-world-cup-semi-finals/ |
| world-mix-01 q057 | Every 4 years | CONFIRMED | https://www.olympics.com.au/news/ioc-statement-tokyo-2020-postponed-until-2021 |
| world-mix-01 q058 | Five | CONFIRMED | https://olympics.com/ioc/news/in-1913-pierre-de-coubertin-designed-one-of-the-world-s-most-famous-symbols |
| world-mix-01 q059 | Love | CONFIRMED | https://www.britannica.com/one-good-fact/why-is-a-zero-score-in-tennis-called-love |
| world-mix-01 q060 | 42 km | CONFIRMED | https://worldathletics.org/disciplines/road/marathon |
| world-mix-01 q061 | Naples | CONFIRMED | https://en.wikipedia.org/wiki/Pizza_Margherita |
| world-mix-01 q062 | Avocado | CONFIRMED | https://www.britannica.com/topic/guacamole |
| world-mix-01 q063 | The stigmas | CONFIRMED | https://www.britannica.com/topic/saffron |
| world-mix-01 q064 | Valencia | CONFIRMED | https://en.wikipedia.org/wiki/Paella |
| world-mix-01 q065 | Almond | CONFIRMED | https://www.britannica.com/topic/marzipan |
| world-mix-01 q066 | True | CONFIRMED | https://www.britannica.com/story/is-a-tomato-a-fruit-or-a-vegetable |
| world-mix-01 q067 | False | CONFIRMED | https://www.britannica.com/question/Can-you-see-the-Great-Wall-of-China-from-space |
| world-mix-01 q068 | False | CONFIRMED | https://www.amnh.org/learn-teach/curriculum-collections/young-naturalist-awards/goldfish-as-a-model-for-understanding-learning-and-memory-more-complex-than-you-think |
| world-mix-01 q069 | Mandarin Chinese | CONFIRMED | https://www.ethnologue.com/insights/most-spoken-language/ |
| world-mix-01 q070 | Cyrillic | CONFIRMED | https://www.britannica.com/topic/Cyrillic-alphabet |
| world-mix-01 q071 | Arigatō | CONFIRMED | https://insidekyoto.com/most-useful-japanese-expressions |
| world-mix-01 q072 | Jupiter | CONFIRMED | https://science.nasa.gov/jupiter/facts/ |
| world-mix-01 q073 | Q | CONFIRMED | https://a-z-animals.com/blog/what-letter-is-not-in-any-state-name-and-which-is-most-popular/ |
| world-mix-01 q074 | The hummingbird | CONFIRMED | https://www.sciencing.com/1864840/why-hummingbirds-only-bird-species-fly-backwards |
| world-mix-01 q075 | Peru | CONFIRMED | https://en.wikipedia.org/wiki/Machu_Picchu |
| lb-quiz-01 q001 | Beirut | CONFIRMED | https://www.britannica.com/place/Beirut |
| lb-quiz-01 q002 | Qornet es-Saouda | CONFIRMED | https://en.wikipedia.org/wiki/Qurnat_as_Sawda%27 |
| lb-quiz-01 q003 | The Litani | CONFIRMED | https://en.wikipedia.org/wiki/Litani_River |
| lb-quiz-01 q004 | Jbeil | CONFIRMED | https://en.wikipedia.org/wiki/Jbeil_(disambiguation) |
| lb-quiz-01 q005 | A system of limestone caves | CONFIRMED | https://en.wikipedia.org/wiki/Jeita_Grotto |
| lb-quiz-01 q006 | Raouché | CONFIRMED | https://afar.com/places/pigeon-rocks-raouche |
| lb-quiz-01 q007 | Zahlé | CONFIRMED | https://www.traveldojo.com/zahle |
| lb-quiz-01 q008 | Bsharri | CONFIRMED | https://whc.unesco.org/en/list/850-002 |
| lb-quiz-01 q009 | False | CONFIRMED | https://en.wikipedia.org/wiki/Sidon |
| lb-quiz-01 q010 | Mzaar Kfardebian | CONFIRMED | https://en.wikipedia.org/wiki/Mzaar_Kfardebian |
| lb-quiz-01 q011 | An alphabet | CONFIRMED | https://www.worldhistory.org/article/17/the-phoenician-alphabet--language/ |
| lb-quiz-01 q012 | 22 November | CONFIRMED | https://en.wikipedia.org/wiki/Public_holidays_in_Lebanon |
| lb-quiz-01 q013 | Roman | CONFIRMED | https://whc.unesco.org/en/list/294 |
| lb-quiz-01 q014 | Bacchus | CONFIRMED | https://en.wikipedia.org/wiki/Temple_of_Bacchus |
| lb-quiz-01 q015 | Purple | CONFIRMED | https://www.worldhistory.org/Tyrian_Purple/ |
| lb-quiz-01 q016 | True | CONFIRMED | https://whc.unesco.org/en/list/295 |
| lb-quiz-01 q017 | Gibran Khalil Gibran | CONFIRMED | https://en.wikipedia.org/wiki/The_Prophet_(book) |
| lb-quiz-01 q018 | Bsharri | CONFIRMED | https://en.wikipedia.org/wiki/Gibran_Museum |
| lb-quiz-01 q019 | The Rock of Tanios | CONFIRMED | https://en.wikipedia.org/wiki/Amin_Maalouf |
| lb-quiz-01 q020 | Grandma | CONFIRMED | https://lebanese-arabic.com/lesson12/ |
| lb-quiz-01 q021 | Tawleh | CONFIRMED | https://egyptianstreets.com/2022/09/10/sheesh-beesh-egypts-5-most-common-tawla-games-and-how-theyre-played/ |
| lb-quiz-01 q022 | True | CONFIRMED | https://core.ac.uk/download/6609.pdf |
| lb-quiz-01 q023 | Improvised sung poetry | CONFIRMED | https://ich.unesco.org/en/RL/01000 |
| lb-quiz-01 q024 | True | CONFIRMED | https://www.baalbeck.org.lb/en/history |
| lb-quiz-01 q025 | Keanu Reeves | CONFIRMED | https://en.wikipedia.org/wiki/Keanu_Reeves |
| lb-quiz-01 q026 | Nouhad Haddad | CONFIRMED | https://en.wikipedia.org/wiki/Fairuz |
| lb-quiz-01 q027 | The Rahbani brothers | CONFIRMED | https://en.wikipedia.org/wiki/Assi_Rahbani |
| lb-quiz-01 q028 | Concierto de Aranjuez | CONFIRMED | https://www.pri.org/file/2020-08-07/fairuz-s-li-beirut |
| lb-quiz-01 q029 | Sabah | CONFIRMED | https://m.imdb.com/es/name/nm0754480/bio |
| lb-quiz-01 q030 | Trumpet | CONFIRMED | https://theartsdesk.com/node/94307 |
| lb-quiz-01 q031 | Mika | CONFIRMED | https://en.wikipedia.org/wiki/Mika_(singer) |
| lb-quiz-01 q032 | A fretless stringed instrument | CONFIRMED | https://en.wikipedia.org/wiki/Oud |
| lb-quiz-01 q033 | Ah W Noss | CONFIRMED | https://en.wikipedia.org/wiki/Ah_W_Noss |
| lb-quiz-01 q034 | A folk line dance | CONFIRMED | https://en.wikipedia.org/wiki/Dabke |
| lb-quiz-01 q035 | Handkerchief | CONFIRMED | https://en.wikipedia.org/wiki/Dabke |
| lb-quiz-01 q036 | Caracalla | CONFIRMED | https://en.wikipedia.org/wiki/Caracalla_Dance_Theatre |
| lb-quiz-01 q037 | The mijwiz (double pipe) | FIXED (EN option "double-reed" wrong: mijwiz is single-reed -> "double pipe") | https://en.wikipedia.org/wiki/Mijwiz |
| lb-quiz-01 q038 | False | CONFIRMED | https://en.wikipedia.org/wiki/Dabke |
| lb-quiz-01 q039 | Zaffeh | CONFIRMED | https://www.theknot.com/content/lebanese-wedding-traditions |
| lb-quiz-01 q040 | The Cedars | CONFIRMED | https://en.wikipedia.org/wiki/Lebanon_national_football_team |
| lb-quiz-01 q041 | 2000 | CONFIRMED | https://en.wikipedia.org/wiki/2000_AFC_Asian_Cup |
| lb-quiz-01 q042 | Germany | CONFIRMED | https://en.wikipedia.org/wiki/Roda_Antar |
| lb-quiz-01 q043 | Basketball | CONFIRMED | https://en.wikipedia.org/wiki/2017_FIBA_Asia_Cup |
| lb-quiz-01 q044 | Al-Ansar | FIXED (time-sensitive: "(as of 2025)" added to question, all 4) | https://en.wikipedia.org/wiki/Lebanese_Premier_League |
| lb-quiz-01 q045 | Qatar | CONFIRMED | https://www.aljazeera.com/sports/2024/1/12/hosts-qatar-beat-lebanon-thrill-fans-afc-asian-cup-2023-opener |
| lb-quiz-01 q046 | 2019 | CONFIRMED | https://en.wikipedia.org/wiki/Lebanon_at_the_AFC_Asian_Cup |
| lb-quiz-01 q047 | Parsley | CONFIRMED | https://en.wikipedia.org/wiki/Tabbouleh |
| lb-quiz-01 q048 | A garlic sauce | CONFIRMED | https://www.themediterraneandish.com/toum-garlic-sauce/ |
| lb-quiz-01 q049 | Turmeric | CONFIRMED | https://en.wikipedia.org/wiki/Sfouf |
| lb-quiz-01 q050 | Raw | FIXED (AR asked a different question/options; replaced with the EN-equivalent) | https://en.wikipedia.org/wiki/Kibbeh_nayyeh |
| lb-quiz-01 q051 | Fattoush | CONFIRMED | https://www.loveandlemons.com/fattoush-salad/ |
| lb-quiz-01 q052 | Nadine Labaki | CONFIRMED | https://www.festival-cannes.com/en/festival/artist/nadine-labaki |
| lb-quiz-01 q053 | The Jury Prize | CONFIRMED | https://www.motionpictures.org/2018/11/first-capernaum-trailer-reveals-director-nadine-labakis-cannes-jury-prize-winner/ |
| lb-quiz-01 q054 | Salma Hayek | CONFIRMED | https://www.biography.com/actors/salma-hayek |
| lb-quiz-01 q055 | A TV talent show | CONFIRMED | https://en.wikipedia.org/wiki/Studio_El_Fan |
| lb-quiz-01 q056 | False | CONFIRMED | https://thenationalnews.com/arts-culture/music-stage/2024/06/10/shakira-lebanese-father-william-mebarak-chadid |
| lb-quiz-01 q057 | Hippodromes | CONFIRMED | https://en.wikipedia.org/wiki/Tyre_Hippodrome |
| lb-quiz-01 q058 | Umayyad | CONFIRMED | https://en.wikipedia.org/wiki/Anjar,_Lebanon |
| lb-quiz-01 q059 | Beiteddine | CONFIRMED | https://en.wikipedia.org/wiki/Beiteddine_Festival |
| lb-quiz-01 q060 | Cedar forests | CONFIRMED | https://www.iucn.org/news/protected-areas/201804/wonders-shouf-biosphere-reserve |
| lb-quiz-01 q061 | The Orontes (Assi) | CONFIRMED | https://www.britannica.com/place/Orontes-River |
| lb-quiz-01 q062 | Saida | CONFIRMED | https://en.wikipedia.org/wiki/Sidon_Sea_Castle |
| lb-quiz-01 q063 | Let's go | CONFIRMED | https://www.thenationalnews.com/arts-culture/2025/07/25/learn-arabic-words-what-is-yallah |
| lb-quiz-01 q064 | Sesame | CONFIRMED | https://www.saveur.com/article/recipes/manoushé-bil-zaatar-flatbread-with-zaatar |
| lb-quiz-01 q065 | A cedar | CONFIRMED | https://flagspot.net/flags/lb.html |
| lb-quiz-01 q066 | Batroun | CONFIRMED | https://en.wikipedia.org/wiki/Batroun |
| lb-quiz-01 q067 | Olive-oil soap | CONFIRMED | https://www.lonelyplanet.com/points-of-interest/khan-as-saboun/1584430 |
| lb-quiz-01 q068 | True | CONFIRMED | https://en.wikipedia.org/wiki/Tyre_Coast_Nature_Reserve |
| lb-quiz-01 q069 | Jezzine | CONFIRMED | https://en.libnanews.com/lebanon-heritage-the-cutlery-of-jezzine/ |
| lb-quiz-01 q070 | A pyramid-topped stone tower | CONFIRMED | https://en.wikipedia.org/wiki/Kamouh_el_Hermel |
| lb-quiz-01 q071 | Fairuz | CONFIRMED | https://www.newarab.com/news/loss-lebanon-fairuz-fans-bid-farewell-ziad-rahbani |
| lb-quiz-01 q072 | Wadih El Safi | CONFIRMED | https://en.wikipedia.org/wiki/Wadih_El_Safi |
| lb-quiz-01 q073 | Achrafieh | CONFIRMED | https://en.wikipedia.org/wiki/Sursock_Museum |
| lb-quiz-01 q074 | Hassan Maatouk | CONFIRMED | https://en.wikipedia.org/wiki/Hassan_Maatouk |
| lb-quiz-01 q075 | Sesame ka'ak bun | CONFIRMED | https://www.anissas.com/my-favourite-breakfast-kaket-knafeh/ |
