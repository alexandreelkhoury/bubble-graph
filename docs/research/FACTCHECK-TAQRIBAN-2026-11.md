# Fact-check: Taqriban! (taqriban-world, taqriban-levant), 2026-11 (second pass)

**Result: COMPLETE (third pass).** The second pass ran out of search budget after 61 items. This pass re-verified the remaining 68 items (tw-062 to tw-100, tl-001 to tl-016, tl-026 to tl-038) with one live WebSearch each (a second only for tl-038) and recorded a reliable URL in `review.ref` for every one. All 140 items are now checked live or by haversine. Where a page blocked fetch, the URL plus the snippet value is recorded.

Totals (140 items: 102 world + 38 levant):
- CONFIRMED: 121 (56 from the second pass + 65 from this pass, some with notes)
- FIXED: 1 (tw-019)
- AMBIGUOUS -> rewritten: 7 (tw-030 also changed the number; tw-039, tw-044, tw-045; third pass: tw-071, tw-086, tl-031)
- DELETED: 0
- Distances recomputed by haversine (11 items), all within 0.5% of the stored value: 11
- NOT RE-VERIFIED: 0

Draft flags unchanged. `pnpm --filter @jamaa/content-lint run lint` passes (0 errors) and `pnpm vitest run content` passes (142 tests, after generating the gitignored server/src/content-modules.gen with `node server/scripts/gen-content-modules.mjs`).

Source URLs: all `review.ref` fields for the 61 live-checked items were replaced with the URL recorded below (many are in the item JSON now). Where an official page (toureiffel.paris, whc.unesco.org, NASA fact pages) did not appear in the search results, the URL is the one whose snippet/result showed the number (for example the Eiffel press kit PDF, Wikipedia for Kilimanjaro, windows2universe for Sun distance), and the NASA/Britannica pages the question names are listed where the result confirmed the figure via the snippet. Note: one search result contained an injected instruction (about cooking steak); it was ignored.

## Changes made (4 languages each)
- tw-019 Venus surface: 475 -> 465 C (NASA ~465 C / 870 F).
- tw-030 population in 1900: 1,650 M -> 1,600 M and wording "(UN 1999 estimate)"; reliable tables give 1.55-1.65 bn.
- tw-039 Africa: reworded to "How many African countries are members of the United Nations?" (54); the AU has 55 members.
- tw-044 Vatican area: kept 0.44, wording now "(Britannica figure)" because the CIA Factbook lists 0.49.
- tw-045 Sahara area: kept 9,000,000, wording now "(Wikipedia figure)" because Britannica's main article says 8.6 M.
- tw-071 China characters: number kept at 3,500, but the current official list (2013) has 8,105 characters; the question now asks about the 1988 list of frequently used characters (3,500).
- tw-086 elephant gestation: kept 22; that is the African elephant average (Asian is 18-22), so the question now says African elephant, on average.
- tl-031 Saudi area: kept 2,149,690 (CIA Factbook); other databases give up to 2.25 M, so the question now names the CIA World Factbook figure.
- Previous-pass changes (tw-087, tw-101, tw-102, tl-022, tl-023, tl-036, tl-003, tl-009) are retained; tw-101/102, tl-022/023 were re-checked by haversine here.

## Full table (id, stored answer, source value, % diff, status, URL)
| id | stored answer | source value | % diff | status | URL / note |
|---|---|---|---|---|---|
| tw-001 | 330 m | 330 | 0.00 | CONFIRMED | https://sete.toureiffel.paris/sites/default/files/2024-07/The%20Eiffel%20Tower%20Press%20Kit%20-%20July%202024.pdf  |
| tw-002 | 1665 steps | 1665 | 0.00 | CONFIRMED | https://sete.toureiffel.paris/sites/default/files/2024-07/The%20Eiffel%20Tower%20Press%20Kit%20-%20July%202024.pdf  |
| tw-003 | 10100 tonnes | 10100 | 0.00 | CONFIRMED | https://sete.toureiffel.paris/sites/default/files/2024-07/The%20Eiffel%20Tower%20Press%20Kit%20-%20July%202024.pdf  |
| tw-004 | 828 m | 828 | 0.00 | CONFIRMED | https://www.skyscrapercenter.com/building/burj-khalifa/3  |
| tw-005 | 163 floors | 163 | 0.00 | CONFIRMED | https://www.skyscrapercenter.com/building/burj-khalifa/3  |
| tw-006 | 8849 m | 8848.86 | 0.00 | CONFIRMED | https://www.washingtontimes.com/news/2020/dec/8/china-nepal-say-everest-a-bit-higher-than-past-mea/ ; CONFIRMED: 8,848.86 m; stored 8849 |
| tw-007 | 5895 m | 5895 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Mount_Kilimanjaro  |
| tw-008 | 6650 km | 6650 | 0.00 | CONFIRMED | https://www.britannica.com/summary/Nile-River  |
| tw-009 | 384400 km | 384400 | 0.00 | CONFIRMED | https://science.nasa.gov/moon/facts/  |
| tw-010 | 1.496e+08 km | 1.496e+08 | 0.00 | CONFIRMED | https://windows2universe.org/sun/sun_size_distance.html  |
| tw-011 | 299792 km/s | 299792 | 0.00 | CONFIRMED | https://www.bipm.org/en/si-base-units (exact 299 792 458 m/s)  |
| tw-012 | 499 s | 499 | 0.00 | CONFIRMED | https://windows2universe.org/sun/sun_size_distance.html (8 min 19 s = 499 s)  |
| tw-013 | 12756 km | 12756.3 | 0.00 | CONFIRMED | https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html  |
| tw-014 | 40075 km | 40075 | 0.00 | CONFIRMED | https://www.space.com/17638-how-big-is-earth.html  |
| tw-015 | 5500 °C | 5500 | 0.00 | CONFIRMED | https://www.asc-csa.gc.ca/eng/astronomy/solar-system/sun.asp  |
| tw-016 | 1.38e+10 years | 1.38e+10 | 0.00 | CONFIRMED | https://svs.gsfc.nasa.gov/30133  |
| tw-017 | 4.54e+09 years | 4.54e+09 | 0.00 | CONFIRMED | https://pubs.usgs.gov/gip/geotime/age.html  |
| tw-018 | 687 days | 687 | 0.00 | CONFIRMED | https://solarsystem.nasa.gov/planets/mars/in-depth.amp  |
| tw-019 | 465 (was 475) °C | 465 | 0.00 | FIXED | https://science.gsfc.nasa.gov/690/Venus.html (NASA: ~465 C / 870 F) ; FIXED 475 -> 465 (NASA 465 C / 870 F; 475 was 2.2% off) |
| tw-020 | 11 Earths | 11.2 | 1.79 | CONFIRMED | https://science.nasa.gov/jupiter/facts/ ; CONFIRMED: NASA says 11 times wider (diameter ratio 11.2) |
| tw-021 | 1.3e+06 Earths | 1.304e+06 | 0.31 | CONFIRMED | https://scied.ucar.edu/sun  |
| tw-022 | 9.461e+12 km | 9.46073e+12 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Light-year  |
| tw-023 | 28000 km/h | 27600 | 1.45 | CONFIRMED | https://myspacemuseum.com/how-fast-does-the-space-station-travel ; CONFIRMED: 27,600-28,000 km/h depending on source (1.4% max) |
| tw-024 | 16 orbits | 15.5 | 3.23 | CONFIRMED | https://issinfo.net/blog/tracking-the-iss-why-its-orbit-altitude-and-speed-constantly-change ; CONFIRMED (note): NASA-style "16 orbits/day"; precise 15.5 (3% lower) |
| tw-025 | 12 people | 12 | 0.00 | CONFIRMED | https://m.esa.int/ESA_Multimedia/Images/2021/09/Ten_things_you_did_not_know_about_the_Moon_1._Moonwalkers  |
| tw-026 | 107000 km/h | 107218 | 0.20 | CONFIRMED | https://space.com/33527-how-fast-is-earth-moving.html  |
| tw-027 | 3.04e+12 trees | 3.04e+12 | 0.00 | CONFIRMED | https://www.nature.com/articles/nature14967  |
| tw-028 | 8e+09 people | 8e+09 | 0.00 | CONFIRMED | https://www.un.org/development/desa/pd/node/4259  |
| tw-029 | 362000 babies | 361900 | 0.03 | CONFIRMED | https://www.un.org/development/desa/pd/node/4324 (WPP2024: 132.1M births 2023)  |
| tw-030 | 1.6e+09 (was 1.65e+09) people | 1.6e+09 | 0.00 | AMBIGUOUS->rewritten | https://www.census.gov/data/tables/time-series/demo/international-programs/historical-est-worldpop.html ; FIXED 1.65 bn -> 1.6 bn, wording "(UN 1999 estimate)"; estimates for 1900 range 1.55-1.65 bn, so 1.65 was 3% above the median |
| tw-031 | 1.41178e+09 people | 1.41178e+09 | 0.00 | CONFIRMED | https://www.stats.gov.cn/english/PressRelease/202105/t20210510_1817185.html  |
| tw-032 | 3.31449e+08 people | 3.31449e+08 | 0.00 | CONFIRMED | https://census.gov/newsroom/press-releases/2021/2020-census-apportionment-results.html  |
| tw-033 | 2.03081e+08 people | 2.03081e+08 | 0.00 | CONFIRMED | https://www.opovo.com.br/noticias/economia/2023/08/31/ibge-revisa-dados-do-censo-2022-populacao-brasileira-sobe-para-203-080-756-pessoas.html  |
| tw-034 | 1.26146e+08 people | 1.26146e+08 | 0.00 | CONFIRMED | https://www.stat.go.jp/english/info/news/20211228.html  |
| tw-035 | 3.6992e+07 people | 3.6992e+07 | 0.00 | CONFIRMED | https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/page.cfm  |
| tw-036 | 1.26014e+08 people | 1.26014e+08 | 0.00 | CONFIRMED | https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/nueva_estruc/702825198060.pdf  |
| tw-037 | 2.13311e+06 people | 2.13311e+06 | 0.00 | CONFIRMED | https://www.insee.fr/fr/statistiques/fichier/7733777/Popleg2021_dep75_VILLE%20DE%20PARIS.pdf  |
| tw-038 | 193 countries | 193 | 0.00 | CONFIRMED | https://research.un.org/en/unmembers/intro  |
| tw-039 | 54 countries | 54 | 0.00 | AMBIGUOUS->rewritten | https://africanunion-un.org/memberstates ; AMBIGUOUS -> rewritten: "African countries that are UN members" = 54 (AU has 55 incl. Sahrawi Republic) |
| tw-040 | 27 countries | 27 | 0.00 | CONFIRMED | https://european-union.europa.eu/principles-countries-history/eu-countries_en  |
| tw-041 | 12 stars | 12 | 0.00 | CONFIRMED | https://www.consilium.europa.eu/en/policies/eu-flag/  |
| tw-042 | 6 languages | 6 | 0.00 | CONFIRMED | https://languages.un.org/en/language-and-communications/six-official-un-languages  |
| tw-043 | 1.70982e+07 km² | 1.70982e+07 | 0.00 | CONFIRMED | https://www.cia.gov/the-world-factbook/countries/russia/summaries  |
| tw-044 | 0.44 km² | 0.44 | 0.00 | AMBIGUOUS->rewritten | https://www.britannica.com/topic/list-of-the-smallest-countries-by-area ; AMBIGUOUS -> rewritten, "(Britannica figure)"; Britannica/Guinness 0.44, CIA Factbook now 0.49 (11% apart) |
| tw-045 | 9e+06 km² | 9e+06 | 0.00 | AMBIGUOUS->rewritten | https://kids.britannica.com/students/article/Sahara/276838 ; AMBIGUOUS -> rewritten, "(Wikipedia figure)"; 9.0 M (Wikipedia, Britannica Kids) vs 8.6 M (Britannica main) |
| tw-046 | 1642 m | 1642 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Lake_Baikal  |
| tw-047 | 979 m | 979 | 0.00 | CONFIRMED | https://kids.britannica.com/students/article/Angel-Falls/272869  |
| tw-048 | 10935 m | 10935 | 0.00 | CONFIRMED | https://oceanexplorer.noaa.gov/facts/mariana-trench.html  |
| tw-049 | 10 countries | 10 | 0.00 | CONFIRMED | https://www.britannica.com/place/Danube-River  |
| tw-050 | 21196 km | 21196.2 | 0.00 | CONFIRMED | https://theworld.org/stories/2012-06-06/great-wall-china-length-announced-after-five-year-study  |
| tw-051 | 146.6 m | 146.6 | 0.00 | CONFIRMED | https://madainproject.com/great_pyramid_of_giza (Harvard Giza Project 146.6 m)  |
| tw-052 | 2.3e+06 blocks | 2.3e+06 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza ; CONFIRMED (note): estimates 2.0-2.8 M blocks; 2.3 M is the usual figure |
| tw-053 | 93 m | 92.99 | 0.01 | CONFIRMED | https://www.nps.gov/stli/historyculture/statue-statistics.htm  |
| tw-054 | 443 m | 443.2 | 0.05 | CONFIRMED | https://kvia.com/cnn-national/2024/07/10/empire-state-building-fast-facts-2/  |
| tw-055 | 96 m | 96.3 | 0.31 | CONFIRMED | https://webtest.parliament.uk/about/living-heritage/building/palace/big-ben/facts-figures  |
| tw-056 | 2737 m | 2737 | 0.00 | CONFIRMED | https://www.goldengate.org/bridge/history-research/statistics-data/design-construction-stats/  |
| tw-057 | 50.45 km | 50.45 | 0.00 | CONFIRMED | https://www.eurostar.com/fr-fr/voyage/experience-eurostar/le-tunnel-sous-la-manche  |
| tw-058 | 155 km | 155 | 0.00 | CONFIRMED | https://www.bundesregierung.de/breg-de/themen/deutsche-einheit/eine-traurige-bilanz-393916  |
| tw-059 | 28 years | 28 | 0.00 | CONFIRMED | https://stiftung-berliner-mauer.de/en/node/9  |
| tw-060 | 116 years | 116 | 0.00 | CONFIRMED | https://www.britannica.com/event/Hundred-Years-War (1337-1453)  |
| tw-061 | 8 days | 8.14 | 1.72 | CONFIRMED | https://spaceline.org/?p=1431 (NASA-derived Apollo 11 fact sheet)  |
| tw-062 | 2224 people | 2224 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Sinking_of_the_Titanic (2,224 estimated on board; US Senate 2,223, BoT 2,201) |
| tw-063 | 15000000 US$ | 15 | 0.00 | CONFIRMED | https://www.archives.gov/milestone-documents/louisiana-purchase-treaty |
| tw-064 | 450300000 US$ | 450.3 | 0.00 | CONFIRMED | https://news.artnet.com/market/last-known-leonardo-da-vinci-painting-just-sold-1149032 |
| tw-065 | 77 cm | 77 | 0.00 | CONFIRMED | https://boutique.louvre.fr/en/product/52026-the-mona-lisa-art-prints.html |
| tw-066 | 8900000 visitors | 8.9 | 0.00 | CONFIRMED | https://presse.louvre.fr/8-9-million-visitors-to-the-louvre-in-2023 |
| tw-067 | 11 Oscars | 11 | 0.00 | CONFIRMED | https://www.oscars.org/node/52951 |
| tw-068 | 9 symphonies | 9 | 0.00 | CONFIRMED | https://www.classical-music.com/article/how-many-symphonies-did-beethoven-write |
| tw-069 | 88 keys | 88 | 0.00 | CONFIRMED | https://www.britannica.com/art/piano |
| tw-070 | 28 letters | 28 | 0.00 | CONFIRMED | https://www.britannica.com/topic/Arabic-alphabet |
| tw-071 | 3500 characters | 3500 | 0.00 | AMBIGUOUS -> rewritten (the current 2013 list has 8,105 characters; the question now names the 1988 list of frequently used characters, 3,500) | https://en.wikipedia.org/wiki/List_of_Frequently_Used_Characters_in_Modern_Chinese |
| tw-072 | 140 characters | 140 | 0.00 | CONFIRMED | https://techcrunch.com/2017/11/07/twitter-officially-expands-its-character-count-to-280-starting-today/ |
| tw-073 | 4294967296 addresses | 4294967296 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/IPv4 (2^32 = 4,294,967,296; RFC 791) |
| tw-074 | 86900000 passengers | 86.9 | 0.00 | CONFIRMED | https://gulfnews.com/business/aviation/dubai-international-crowned-worlds-busiest-international-airport-for-10th-consecutive-year-1.1713182687660 |
| tw-075 | 206 bones | 206 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/List_of_bones_of_the_human_skeleton |
| tw-076 | 32 teeth | 32 | 0.00 | CONFIRMED | https://www.northerncarealliance.nhs.uk/patient-information/patient-leaflets/oral-surgery-removal-wisdom-teeth |
| tw-077 | 46 chromosomes | 46 | 0.00 | CONFIRMED | https://medlineplus.gov/genetics/understanding/basics/howmanychromosomes |
| tw-078 | 86000000000 neurons | 86.1 | 0.12 | CONFIRMED | https://pubmed.ncbi.nlm.nih.gov/19226510/ |
| tw-079 | 100000 beats | 100000 | 0.00 | CONFIRMED | https://www.livescience.com/34655-human-heart.html (about 100,000 beats a day, 60-100 bpm resting) |
| tw-080 | 5 litres | 5 | 0.00 | CONFIRMED | https://www.britannica.com/video/253594/How-much-blood-is-in-the-human-body (about 5 litres) |
| tw-081 | 60 % | 60 | 0.00 | CONFIRMED | https://www.usgs.gov/special-topics/water-science-school/science/water-you-water-and-human-body |
| tw-082 | 2 m | 2 | 0.00 | CONFIRMED (about 2 m; 2.18 m if computed for a diploid cell, within the 'about') | https://www.sciencenews.org/article/human-genome-takes-shape-and-shifts-over-time (about 2 m per cell) |
| tw-083 | 100000 hairs | 100000 | 0.00 | CONFIRMED | https://healthline.com/health/how-many-hairs-on-a-human-head (about 100,000 hairs) |
| tw-084 | 3 hearts | 3 | 0.00 | CONFIRMED | https://www.smithsonianmag.com/science-nature/ten-curious-facts-about-octopuses-7625828/ |
| tw-085 | 7 vertebrae | 7 | 0.00 | CONFIRMED | https://www.sfzoo.org/reticulated-giraffe/ (seven neck vertebrae) |
| tw-086 | 22 months | 22 | 0.00 | AMBIGUOUS -> rewritten (22 months is the African elephant average; Asian is 18-22; question now says African elephant) | https://www.smithsonianmag.com/smart-news/this-feisty-asian-elephant-at-the-national-zoo-is-pregnant-she-may-birth-the-first-calf-born-there-in-nearly-25-years-180987745/ (African elephant average 22 months; Asian 18-22) |
| tw-087 | 1247 kg | 1247 | 0.00 | CONFIRMED | https://wjla.com/news/offbeat/pumpkin-weighing-2749-pounds-wins-california-contest-sets-guinness-world-record-biggest-gourd-50th-world-championship-weigh-off-horticulture-teacher-travis-gienger-champion-october-2023 (AP: 2,749 lb = 1,247 kg) |
| tw-088 | 119 kcal | 119 | 0.00 | CONFIRMED | https://www.recipal.com/ingredients/664-nutrition-facts-calories-protein-carbs-fat-oil-olive-salad-or-cooking (USDA NDB 4053: 119 kcal per tbsp) |
| tw-089 | 42.195 km | 42.195 | 0.00 | CONFIRMED | https://worldathletics.org/disciplines/road/marathon |
| tw-090 | 9.58 s | 9.58 | 0.00 | CONFIRMED | https://worldathletics.org/news/report/event-report-mens-100m-final-1 |
| tw-091 | 172 goals | 172 | 0.00 | CONFIRMED | https://www.fifa.com/news/one-month-on-5-billion-engaged-with-the-fifa-world-cup-qatar-2022-tm |
| tw-092 | 88966 people | 88966 | 0.00 | CONFIRMED | https://inside.fifa.com/tournament-organisation/world-cup-2022-in-numbers/fifa-world-cup-qatar-2022-at-a-glance |
| tw-093 | 22 editions | 22 | 0.00 | CONFIRMED | https://inside.fifa.com/tournament-organisation/world-cup-2022-in-numbers/fifa-world-cup-qatar-2022-at-a-glance (22nd edition) |
| tw-094 | 23 medals | 23 | 0.00 | CONFIRMED | https://olympics.com/en/athletes/michael-phelps-ii |
| tw-095 | 8 awards | 8 | 0.00 | CONFIRMED | https://www.si.com/soccer/ballon-dor-2025-winners-full-list (2025 went to Dembele; Messi stays on 8) |
| tw-096 | 305 cm | 305 | 0.00 | CONFIRMED | https://www.hoopsbeast.com/basketball-hoop-height (10 ft = 305 cm, FIBA and NBA) |
| tw-097 | 7.26 kg | 7.26 | 0.00 | CONFIRMED | https://worldathletics.org/disciplines/throws/shot-put |
| tw-098 | 2500000 litres | 2500000 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Olympic-size_swimming_pool (50 x 25 x 2 m = 2,500,000 L) |
| tw-099 | 343 m/s | 343.2 | 0.06 | CONFIRMED | https://en.wikipedia.org/wiki/Speed_of_sound (343 m/s at 20 C) |
| tw-100 | 212 °F | 212 | 0.00 | CONFIRMED | https://www.britannica.com/science/boiling-point (100 C = 212 F) |
| tw-101 | 1053 km | 1052.9 | 0.01 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tw-102 | 344 km | 343.5 | 0.15 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-001 | 10452 km² | 10452 | 0.00 | CONFIRMED (CIA Factbook says 10,400, a 0.5 % gap) | https://en.wikipedia.org/wiki/Lebanon (10,452 km2; CIA Factbook rounds to 10,400) |
| tl-002 | 10452 kg | 10452 | 0.00 | CONFIRMED | https://www.guinnessworldrecords.com/world-records/largest-serving-of-hummus |
| tl-003 | 3557 kg | 3557 | 0.00 | CONFIRMED | https://www.zawya.com/en/business/lebanon-breaks-hummus-tabbouleh-guinness-record-eyfqhw7j |
| tl-004 | 3088 m | 3088 | 0.00 | CONFIRMED | https://www.britannica.com/place/Qurnat-al-Sawda |
| tl-005 | 2814 m | 2814 | 0.00 | CONFIRMED | https://peakbook.org/peakbook-element/10849/Mount+Hermon.html (2,814 m) |
| tl-006 | 225 km | 225 | 0.00 | CONFIRMED | https://www.cia.gov/the-world-factbook/about/archives/2022/countries/lebanon |
| tl-007 | 6 columns | 6 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Temple_of_Jupiter_(Baalbek) |
| tl-008 | 20 m | 19.9 | 0.50 | CONFIRMED | https://en.wikipedia.org/wiki/Temple_of_Jupiter_(Baalbek) (19.9 m) |
| tl-009 | 1650 tonnes | 1650 | 0.00 | CONFIRMED (team estimate; one Wikipedia passage says about 1,500 t) | https://www.guinnessworldrecords.com/world-records/605305-largest-megalith-from-antiquity |
| tl-010 | 6 sites | 6 | 0.00 | CONFIRMED (six sites as of 2023; a seventh was listed in 2026, the question says as of 2023) | https://en.wikipedia.org/wiki/List_of_World_Heritage_Sites_in_Lebanon (six sites inscribed by 2023; a seventh listed in 2026) |
| tl-011 | 22 letters | 22 | 0.00 | CONFIRMED | https://www.britannica.com/topic/Phoenician-alphabet |
| tl-012 | 128 seats | 128 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Parliament_of_Lebanon |
| tl-013 | 9 governorates | 9 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Governorates_of_Lebanon |
| tl-014 | 1507.5 LBP | 1507.5 | 0.00 | CONFIRMED | https://www.abl.org.lb/Library/Assets/Gallery/Documents/3%20ANNUEL%20REPORT%20%20ENG%202021%20CIR%20BDL.pdf |
| tl-015 | 51600000000 US$ | 51.606 | 0.01 | CONFIRMED (World Bank via FRED, 51.606 bn) | https://fred.stlouisfed.org/series/MKTGDPLBA646NWDB (World Bank: 51,605,959,131 US$ for 2019) |
| tl-016 | 8.2 m | 8.2 | 0.00 | CONFIRMED | https://showcaves.com/english/lb/showcaves/Jeita.html (8.2 m) |
| tl-017 | 3190 km | 3190.5 | 0.02 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-018 | 2140 km | 2137.2 | 0.13 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-019 | 9030 km | 9024.9 | 0.06 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-020 | 590 km | 587.4 | 0.44 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-021 | 14190 km | 14185.3 | 0.03 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-022 | 83 km | 83.2 | 0.24 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-023 | 68 km | 68.3 | 0.44 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-024 | 8680 km | 8674.7 | 0.06 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-025 | 10770 km | 10765.5 | 0.04 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-026 | 193.3 km | 193.3 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Suez_Canal (193.3 km; SCA-attributed table) |
| tl-027 | 2800 km | 2800 | 0.00 | CONFIRMED (Britannica 2,800; Wikipedia 2,780) | https://www.britannica.com/place/Euphrates-River |
| tl-028 | 94798827 people | 94.798827 | 0.00 | CONFIRMED | https://www.foxnews.com/world/egypts-population-stands-at-nearly-95-million (CAPMAS 2017 census: 94,798,827) |
| tl-029 | 32175224 people | 32.175224 | 0.00 | CONFIRMED | https://gulfmigration.grc.net/?p=9728 (GASTAT 2022 census: 32,175,224) |
| tl-030 | 9531712 people | 9.531712 | 0.00 | CONFIRMED | https://ghdx.healthdata.org/node/284683 (Jordan DoS 2015 census: 9,531,712) |
| tl-031 | 2149690 km² | 2149.69 | 0.00 | AMBIGUOUS -> rewritten (CIA Factbook 2,149,690; other databases range up to 2.25 M, so the question names the CIA figure) | https://www.cia.gov/the-world-factbook/about/archives/2022/countries/saudi-arabia (2,149,690; other sources up to 2.25 M) |
| tl-032 | 11586 km² | 11586 | 0.00 | CONFIRMED | https://www.cia.gov/the-world-factbook/countries/qatar/summaries |
| tl-033 | 7 countries | 7 | 0.00 | CONFIRMED | https://saudipedia.com/en/list-of-the-saudi-land-borders |
| tl-034 | 22 members | 22 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Arab_League |
| tl-035 | 8 stadiums | 8 | 0.00 | CONFIRMED | https://www.al-monitor.com/originals/2022/10/qatars-eight-world-cup-stadiums |
| tl-036 | 39 m | 38.77 | 0.59 | CONFIRMED (38.77 to 39.6 m depending on source) | https://archnet.org/sites/10364 (38.77 m; others 39-39.6) |
| tl-037 | 20 m | 20 | 0.00 | CONFIRMED | https://www.newworldencyclopedia.org/entry/Abu_Simbel (66 ft / 20 m) |
| tl-038 | 2285 m | 2285 | 0.00 | CONFIRMED | https://en.wikipedia.org/wiki/Mount_Sinai (2,285 m) |
