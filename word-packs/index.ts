// Pack registry. Each pack is validated with WordPackSchema by consumers (server, sim, tests).
// Order: en, fr, ar; packs sorted by id within a language. pack-lint warns when a pack file is not listed here.
import enEveryday01 from "./packs/en/en-everyday-01.json";
import enFood01 from "./packs/en/en-food-01.json";
import enLeisure01 from "./packs/en/en-leisure-01.json";
import enNature01 from "./packs/en/en-nature-01.json";
import enPlaces01 from "./packs/en/en-places-01.json";
import enThings01 from "./packs/en/en-things-01.json";
import frEveryday01 from "./packs/fr/fr-everyday-01.json";
import frFood01 from "./packs/fr/fr-food-01.json";
import frLeisure01 from "./packs/fr/fr-leisure-01.json";
import frNature01 from "./packs/fr/fr-nature-01.json";
import frPlaces01 from "./packs/fr/fr-places-01.json";
import frThings01 from "./packs/fr/fr-things-01.json";
import arEveryday01 from "./packs/ar/ar-everyday-01.json";
import arHome01 from "./packs/ar/ar-home-01.json";
import arNature01 from "./packs/ar/ar-nature-01.json";
import lbFood01 from "./packs/ar/lb-food-01.json";
import lbLife01 from "./packs/ar/lb-life-01.json";

export const PACKS: readonly unknown[] = [
  enEveryday01,
  enFood01,
  enLeisure01,
  enNature01,
  enPlaces01,
  enThings01,
  frEveryday01,
  frFood01,
  frLeisure01,
  frNature01,
  frPlaces01,
  frThings01,
  arEveryday01,
  arHome01,
  arNature01,
  lbFood01,
  lbLife01,
];
