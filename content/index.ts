// Content registry (JAMAA-PLATFORM §5.1). Mish Ana! word packs live in mishana/<lang>/. Each pack is validated with WordPackSchema by consumers (server, sim, tests).
// Order: en, fr, ar, es; packs sorted by id within a language. content-lint warns when a pack file is not listed here.
import enEveryday01 from "./mishana/en/en-everyday-01.json";
import enFood01 from "./mishana/en/en-food-01.json";
import enLeisure01 from "./mishana/en/en-leisure-01.json";
import enNature01 from "./mishana/en/en-nature-01.json";
import enPlaces01 from "./mishana/en/en-places-01.json";
import enThings01 from "./mishana/en/en-things-01.json";
import frEveryday01 from "./mishana/fr/fr-everyday-01.json";
import frFood01 from "./mishana/fr/fr-food-01.json";
import frLeisure01 from "./mishana/fr/fr-leisure-01.json";
import frNature01 from "./mishana/fr/fr-nature-01.json";
import frPlaces01 from "./mishana/fr/fr-places-01.json";
import frThings01 from "./mishana/fr/fr-things-01.json";
import arEveryday01 from "./mishana/ar/ar-everyday-01.json";
import arHome01 from "./mishana/ar/ar-home-01.json";
import arNature01 from "./mishana/ar/ar-nature-01.json";
import lbFood01 from "./mishana/ar/lb-food-01.json";
import lbLife01 from "./mishana/ar/lb-life-01.json";
import esEveryday01 from "./mishana/es/es-everyday-01.json";
import esFood01 from "./mishana/es/es-food-01.json";
import esLeisure01 from "./mishana/es/es-leisure-01.json";
import esNature01 from "./mishana/es/es-nature-01.json";
import esPlaces01 from "./mishana/es/es-places-01.json";
import esThings01 from "./mishana/es/es-things-01.json";

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
  esEveryday01,
  esFood01,
  esLeisure01,
  esNature01,
  esPlaces01,
  esThings01,
];
