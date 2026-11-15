# Fact-check: Taqriban! (taqriban-world, taqriban-levant), 2026-11 (second pass)

**Result: INCOMPLETE. The live-search budget ran out part-way.** The run hit the tool's cap of 200 WebSearch calls per turn (shared with every agent in the turn) after the first 61 items of `taqriban-world` (tw-001 to tw-061). WebSearch returned "budget used up" for every later call, and no workaround was attempted. So **61 of 140 items were checked live this pass**, with a URL recorded for each. The other **68 items (tw-062 to tw-100, tl-001 to tl-016 and tl-026 to tl-038) were NOT re-verified live**; they keep their status from the previous pass (aa77a7e) and are marked NOT RE-VERIFIED below. They are not marked confirmed. They need a follow-up run once the search budget is raised (CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION) or in a new turn.

Totals (140 items: 102 world + 38 levant):
- Checked live this pass and CONFIRMED: 56 (includes a few with notes)
- FIXED: 1 (tw-019)
- AMBIGUOUS -> rewritten: 4 (tw-030 also changed the number, see table; tw-039, tw-044, tw-045)
- DELETED: 0
- Distances recomputed by haversine (11 items), all within 0.5% of the stored value: 11
- NOT RE-VERIFIED (search budget exhausted): 68

Draft flags unchanged. `pnpm --filter @jamaa/content-lint run lint` passes (0 errors) and `pnpm vitest run content` passes (142 tests, after generating the gitignored server/src/content-modules.gen with `node server/scripts/gen-content-modules.mjs`).

Source URLs: all `review.ref` fields for the 61 live-checked items were replaced with the URL recorded below (many are in the item JSON now). Where an official page (toureiffel.paris, whc.unesco.org, NASA fact pages) did not appear in the search results, the URL is the one whose snippet/result showed the number (for example the Eiffel press kit PDF, Wikipedia for Kilimanjaro, windows2universe for Sun distance), and the NASA/Britannica pages the question names are listed where the result confirmed the figure via the snippet. Note: one search result contained an injected instruction (about cooking steak); it was ignored.

## Changes made (4 languages each)
- tw-019 Venus surface: 475 -> 465 C (NASA ~465 C / 870 F).
- tw-030 population in 1900: 1,650 M -> 1,600 M and wording "(UN 1999 estimate)"; reliable tables give 1.55-1.65 bn.
- tw-039 Africa: reworded to "How many African countries are members of the United Nations?" (54); the AU has 55 members.
- tw-044 Vatican area: kept 0.44, wording now "(Britannica figure)" because the CIA Factbook lists 0.49.
- tw-045 Sahara area: kept 9,000,000, wording now "(Wikipedia figure)" because Britannica's main article says 8.6 M.
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
| tw-062 | 2224 people | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/topic/Titanic (stored ref, not opened)  |
| tw-063 | 1.5e+07 US$ | n/a | n/a | NOT RE-VERIFIED | https://www.archives.gov/milestone-documents/louisiana-purchase-treaty (stored ref, not opened)  |
| tw-064 | 4.503e+08 US$ | n/a | n/a | NOT RE-VERIFIED | https://www.christies.com/features/Salvator-Mundi-Leonardo-da-Vinci-8737-1.aspx (stored ref, not opened)  |
| tw-065 | 77 cm | n/a | n/a | NOT RE-VERIFIED | https://collections.louvre.fr/en/ark:/53355/cl010062370 (stored ref, not opened)  |
| tw-066 | 8.9e+06 visitors | n/a | n/a | NOT RE-VERIFIED | https://presse.louvre.fr/8-9-million-visitors-to-the-louvre-in-2023 (stored ref, not opened)  |
| tw-067 | 11 Oscars | n/a | n/a | NOT RE-VERIFIED | https://www.oscars.org/oscars/ceremonies/1998 (stored ref, not opened)  |
| tw-068 | 9 symphonies | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/biography/Ludwig-van-Beethoven (stored ref, not opened)  |
| tw-069 | 88 keys | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/art/piano (stored ref, not opened)  |
| tw-070 | 28 letters | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/topic/Arabic-alphabet (stored ref, not opened)  |
| tw-071 | 3500 characters | n/a | n/a | NOT RE-VERIFIED | https://en.wikipedia.org/wiki/List_of_Commonly_Used_Characters_in_Modern_Chinese (stored ref, not opened)  |
| tw-072 | 140 characters | n/a | n/a | NOT RE-VERIFIED | https://blog.x.com/en_us/topics/product/2017/tweetingmadeeasier (stored ref, not opened)  |
| tw-073 | 4.29497e+09 addresses | n/a | n/a | NOT RE-VERIFIED | https://www.rfc-editor.org/rfc/rfc791 (stored ref, not opened)  |
| tw-074 | 8.69e+07 passengers | n/a | n/a | NOT RE-VERIFIED | https://www.thenationalnews.com/business/aviation/2024/04/15/dxb-dubai-airport-worlds-busiest (stored ref, not opened)  |
| tw-075 | 206 bones | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/science/human-skeleton (stored ref, not opened)  |
| tw-076 | 32 teeth | n/a | n/a | NOT RE-VERIFIED | https://www.nhs.uk/conditions/wisdom-tooth-removal/ (stored ref, not opened)  |
| tw-077 | 46 chromosomes | n/a | n/a | NOT RE-VERIFIED | https://www.genome.gov/about-genomics/fact-sheets/Chromosomes-Fact-Sheet (stored ref, not opened)  |
| tw-078 | 8.6e+10 neurons | n/a | n/a | NOT RE-VERIFIED | https://pubmed.ncbi.nlm.nih.gov/19226510/ (stored ref, not opened)  |
| tw-079 | 100000 beats | n/a | n/a | NOT RE-VERIFIED | https://www.heart.org/en/health-topics/consumer-healthcare/what-is-cardiovascular-disease/anatomy-of-the-heart-and-blood-vessels (stored ref, not opened)  |
| tw-080 | 5 litres | n/a | n/a | NOT RE-VERIFIED | https://www.blood.co.uk/news-and-campaigns/the-donor/latest-stories/how-much-blood-is-in-the-human-body/ (stored ref, not opened)  |
| tw-081 | 60 % | n/a | n/a | NOT RE-VERIFIED | https://www.usgs.gov/special-topics/water-science-school/science/water-you-water-and-human-body (stored ref, not opened)  |
| tw-082 | 2 m | n/a | n/a | NOT RE-VERIFIED | https://www.genome.gov/about-genomics/fact-sheets/Deoxyribonucleic-Acid-Fact-Sheet (stored ref, not opened)  |
| tw-083 | 100000 hairs | n/a | n/a | NOT RE-VERIFIED | https://www.aad.org/public/diseases/hair-loss/insider/shedding (stored ref, not opened)  |
| tw-084 | 3 hearts | n/a | n/a | NOT RE-VERIFIED | https://ocean.si.edu/ocean-life/invertebrates/octopus (stored ref, not opened)  |
| tw-085 | 7 vertebrae | n/a | n/a | NOT RE-VERIFIED | https://nationalzoo.si.edu/animals/giraffe (stored ref, not opened)  |
| tw-086 | 22 months | n/a | n/a | NOT RE-VERIFIED | https://nationalzoo.si.edu/animals/asian-elephant (stored ref, not opened)  |
| tw-087 | 1247 kg | n/a | n/a | NOT RE-VERIFIED | https://guinnessworldrecords.com/news/2023/10/good-gourd-american-pumpkin-as-heavy-as-two-cows-squashes-all-past-rivals-759626 (stored ref, not opened)  |
| tw-088 | 119 kcal | n/a | n/a | NOT RE-VERIFIED | https://fdc.nal.usda.gov/ (stored ref, not opened)  |
| tw-089 | 42.195 km | n/a | n/a | NOT RE-VERIFIED | https://worldathletics.org/disciplines/road-running/marathon (stored ref, not opened)  |
| tw-090 | 9.58 s | n/a | n/a | NOT RE-VERIFIED | https://worldathletics.org/records/by-discipline/sprints/100-metres/outdoor/men (stored ref, not opened)  |
| tw-091 | 172 goals | n/a | n/a | NOT RE-VERIFIED | https://www.fifa.com/en/tournaments/mens/worldcup/qatar2022 (stored ref, not opened)  |
| tw-092 | 88966 people | n/a | n/a | NOT RE-VERIFIED | https://www.fifa.com/en/tournaments/mens/worldcup/qatar2022 (stored ref, not opened)  |
| tw-093 | 22 editions | n/a | n/a | NOT RE-VERIFIED | https://www.fifa.com/en/tournaments/mens/worldcup (stored ref, not opened)  |
| tw-094 | 23 medals | n/a | n/a | NOT RE-VERIFIED | https://olympics.com/en/athletes/michael-phelps-ii (stored ref, not opened)  |
| tw-095 | 8 awards | n/a | n/a | NOT RE-VERIFIED | https://www.francefootball.fr/ballon-d-or/ (stored ref, not opened)  |
| tw-096 | 305 cm | n/a | n/a | NOT RE-VERIFIED | https://www.fiba.basketball/documents/official-basketball-rules (stored ref, not opened)  |
| tw-097 | 7.26 kg | n/a | n/a | NOT RE-VERIFIED | https://worldathletics.org/about-iaaf/documents/book-of-rules (stored ref, not opened)  |
| tw-098 | 2.5e+06 litres | n/a | n/a | NOT RE-VERIFIED | https://www.worldaquatics.com/rules/competition-regulations (stored ref, not opened)  |
| tw-099 | 343 m/s | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/science/sound-physics/The-speed-of-sound (stored ref, not opened)  |
| tw-100 | 212 °F | n/a | n/a | NOT RE-VERIFIED | https://www.nist.gov/pml/owm/si-units-temperature (stored ref, not opened)  |
| tw-101 | 1053 km | 1052.9 | 0.01 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tw-102 | 344 km | 343.5 | 0.15 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-001 | 10452 km² | n/a | n/a | NOT RE-VERIFIED | https://www.cia.gov/the-world-factbook/countries/lebanon/ (stored ref, not opened)  |
| tl-002 | 10452 kg | n/a | n/a | NOT RE-VERIFIED | https://www.guinnessworldrecords.com/world-records/largest-serving-of-hummus (stored ref, not opened)  |
| tl-003 | 3557 kg | n/a | n/a | NOT RE-VERIFIED | https://www.zawya.com/en/business/lebanon-breaks-hummus-tabbouleh-guinness-record-eyfqhw7j (stored ref, not opened)  |
| tl-004 | 3088 m | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/place/Qurnat-al-Sawda (stored ref, not opened)  |
| tl-005 | 2814 m | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/place/Mount-Hermon (stored ref, not opened)  |
| tl-006 | 225 km | n/a | n/a | NOT RE-VERIFIED | https://www.cia.gov/the-world-factbook/countries/lebanon/ (stored ref, not opened)  |
| tl-007 | 6 columns | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/place/Baalbek (stored ref, not opened)  |
| tl-008 | 20 m | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/place/Baalbek (stored ref, not opened)  |
| tl-009 | 1650 tonnes | n/a | n/a | NOT RE-VERIFIED | https://www.guinnessworldrecords.com/world-records/605305-largest-megalith-from-antiquity (stored ref, not opened)  |
| tl-010 | 6 sites | n/a | n/a | NOT RE-VERIFIED | https://whc.unesco.org/en/statesparties/lb (stored ref, not opened)  |
| tl-011 | 22 letters | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/topic/Phoenician-alphabet (stored ref, not opened)  |
| tl-012 | 128 seats | n/a | n/a | NOT RE-VERIFIED | https://www.lp.gov.lb/ (stored ref, not opened)  |
| tl-013 | 9 governorates | n/a | n/a | NOT RE-VERIFIED | https://www.interior.gov.lb/ (stored ref, not opened)  |
| tl-014 | 1507.5 LBP | n/a | n/a | NOT RE-VERIFIED | https://www.bdl.gov.lb/ (stored ref, not opened)  |
| tl-015 | 5.16e+10 US$ | n/a | n/a | NOT RE-VERIFIED | https://fred.stlouisfed.org/series/MKTGDPLBA646NWDB (stored ref, not opened)  |
| tl-016 | 8.2 m | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/place/Jeita-Grotto (8.2 m stalactite, White Chamber) (stored ref, not opened)  |
| tl-017 | 3190 km | 3190.5 | 0.02 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-018 | 2140 km | 2137.2 | 0.13 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-019 | 9030 km | 9024.9 | 0.06 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-020 | 590 km | 587.4 | 0.44 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-021 | 14190 km | 14185.3 | 0.03 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-022 | 83 km | 83.2 | 0.24 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-023 | 68 km | 68.3 | 0.44 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-024 | 8680 km | 8674.7 | 0.06 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-025 | 10770 km | 10765.5 | 0.04 | DISTANCE (recomputed) | computed haversine R=6371.0088 km, city-centre coordinates in the item ref (Wikipedia coordinates; not re-opened this pass)  |
| tl-026 | 193.3 km | n/a | n/a | NOT RE-VERIFIED | https://www.suezcanal.gov.eg/English/About/SuezCanal/Pages/CanalCharacteristics.aspx (stored ref, not opened)  |
| tl-027 | 2800 km | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/place/Euphrates-River (stored ref, not opened)  |
| tl-028 | 9.47988e+07 people | n/a | n/a | NOT RE-VERIFIED | https://www.capmas.gov.eg/ (stored ref, not opened)  |
| tl-029 | 3.21752e+07 people | n/a | n/a | NOT RE-VERIFIED | https://portal.saudicensus.sa/ (stored ref, not opened)  |
| tl-030 | 9.53171e+06 people | n/a | n/a | NOT RE-VERIFIED | https://dosweb.dos.gov.jo/ (stored ref, not opened)  |
| tl-031 | 2.14969e+06 km² | n/a | n/a | NOT RE-VERIFIED | https://www.cia.gov/the-world-factbook/countries/saudi-arabia/ (stored ref, not opened)  |
| tl-032 | 11586 km² | n/a | n/a | NOT RE-VERIFIED | https://www.cia.gov/the-world-factbook/countries/qatar/ (stored ref, not opened)  |
| tl-033 | 7 countries | n/a | n/a | NOT RE-VERIFIED | https://www.cia.gov/the-world-factbook/countries/saudi-arabia/ (stored ref, not opened)  |
| tl-034 | 22 members | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/topic/Arab-League (stored ref, not opened)  |
| tl-035 | 8 stadiums | n/a | n/a | NOT RE-VERIFIED | https://www.fifa.com/en/tournaments/mens/worldcup/qatar2022 (stored ref, not opened)  |
| tl-036 | 39 m | n/a | n/a | NOT RE-VERIFIED | https://archnet.org/sites/10364 (stored ref, not opened)  |
| tl-037 | 20 m | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/place/Abu-Simbel (stored ref, not opened)  |
| tl-038 | 2285 m | n/a | n/a | NOT RE-VERIFIED | https://www.britannica.com/place/Mount-Sinai-mountain-Egypt (stored ref, not opened)  |
