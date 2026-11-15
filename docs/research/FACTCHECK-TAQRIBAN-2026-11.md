# Fact-check: Taqriban! (taqriban-world, taqriban-levant), 2026-11

Totals: 140 checked (102 world, 38 levant); 132 confirmed unchanged; 8 edited (6 content fixes, 2 source-only); 0 deleted.
Draft flags unchanged.

Method and honesty note: about 25 items were re-verified live by web search this pass (Eiffel Tower, pumpkin, Lebanon GDP, Baalbek, Petra, Jeita, hummus/tabbouleh, UNESCO Lebanon, Louvre, Dubai airport, births, Lebanese mountains). Roughly 95 more are stable, widely published constants or census figures (SI constants, NASA fact sheets, national censuses, Britannica) that were checked against well-known values; their original source URLs were NOT reopened (several official sites, e.g. toureiffel.paris and whc.unesco.org, return HTTP 403 to automated fetch). All 11 distance items were recomputed by haversine (R = 6371.0088 km).

All four translations were checked mechanically: every digit string in the question matches across EN/FR/AR/ES (only difference: tw-098 Arabic spells "2" in words) and units agree. Wording was not re-audited beyond that.

## Non-confirmed items

| id | verdict | issue | action | source |
|---|---|---|---|---|
| tw-087 | OUTDATED | "Heaviest pumpkin ever (2023 record)": Guinness now reports newer records (1,295.8 kg, then 1,431.5 kg in Oct 2026), so the "ever" question has a different answer today | Reworded in all 4 languages: "In October 2023 Travis Gienger set a pumpkin world record: weight?"; answer 1247 (1,246.9 kg) kept | https://guinnessworldrecords.com/news/2023/10/good-gourd-american-pumpkin-as-heavy-as-two-cows-squashes-all-past-rivals-759626 |
| tw-101 | CONFIRMED (tightened) | Paris-Madrid computed 1052.9 km, stored 1050 (0.3 %) | answer 1053 | computed haversine |
| tw-102 | WRONG (borderline) | London-Paris computed 343.5 km, stored 340 and note said 344 | answer 344 | computed haversine |
| tl-022 | WRONG | Beirut-Damascus computed 83.2 km, stored 85 (2.2 %, outside the 2 % bonus band) | answer 83 | computed haversine |
| tl-023 | WRONG | Beirut-Tripoli computed 68.3 km, stored 70 (2.5 %) | answer 68 | computed haversine |
| tl-036 | WRONG (borderline) | Treasury facade in Petra: surveys give 38.8-39.6 m; stored 40 was 2.5 % above 39.1 | answer 39 | https://archnet.org/sites/10364 |
| tl-003 | CONFIRMED, source fixed | 3,557 kg tabbouleh (25 Oct 2009, Beirut) confirmed by the Daily Star; the old Guinness URL could not be verified | source/ref updated | https://www.zawya.com/en/business/lebanon-breaks-hummus-tabbouleh-guinness-record-eyfqhw7j |
| tl-009 | CONFIRMED, source fixed | Baalbek block about 1,650 t (Guinness estimate; some outlets say 1,500 t) | ref was only dainst.org homepage; now Guinness | https://www.guinnessworldrecords.com/world-records/605305-largest-megalith-from-antiquity |

Other distance answers were already within 2 % of the computed value (Paris 3190.5, Dubai 2137.2, New York 9024.9, Cairo 587.4, Sydney 14185.3, Montreal 8674.7, Sao Paulo 10765.5 km). Questions say "as the crow flies", i.e. straight-line.

## Notes (kept, flagged)
- tl-010 (Lebanon UNESCO sites "as of 2023"): 6 is correct for 2023 (Rachid Karami Fair inscribed Jan 2023, https://whc.unesco.org/en/news/2516). The current count may be higher (a Wikipedia snapshot mentions a 2026 inscription, unconfirmed), so the "as of 2023" qualifier must stay.
- tl-008 (Baalbek columns about 20 m): sources range 19.9-22.9 m; 20 is within 2 % of the best-sourced 19.9 m.
- tl-016 (Jeita stalactite 8.2 m): consistent across sources.
- tw-029 (births 2023, 362,000/day): UN WPP 2024 about 132.1 M, 361.9 k/day. OK.
- Confirmed live: tw-001/002/003 (SETE: 330 m, 1,665 steps, 10,100 t), tw-066 (Louvre 8.9 M, https://presse.louvre.fr/8-9-million-visitors-to-the-louvre-in-2023), tw-074 (DXB 86.9 M), tl-002 (hummus 10,452 kg, https://www.guinnessworldrecords.com/world-records/largest-serving-of-hummus), tl-015 (GDP 51.6 bn, https://fred.stlouisfed.org/series/MKTGDPLBA646NWDB), tl-004/005 (3,088 m / 2,814 m).
