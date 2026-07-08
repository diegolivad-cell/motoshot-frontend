/** Marcas de moto frecuentes en Guatemala — colores y normalización de clave. */
export const BRAND_COLORS = {
  honda: "#FF3B3B",
  suzuki: "#2E86FF",
  bajaj: "#4D7CFF",
  italika: "#FF6A00",
  yamaha: "#3B7DFF",
  ktm: "#FF6A00",
  kawasaki: "#69BE28",
  cfmoto: "#3FA0FF",
  "cf moto": "#3FA0FF",
  ducati: "#FF2E2E",
  bmw: "#4AA8FF",
  benelli: "#37C46B",
  aprilia: "#FF3B3B",
  triumph: "#C9D2FF",
  "harley-davidson": "#FF8A3C",
  harley: "#FF8A3C",
  husqvarna: "#3B7DFF",
  "royal enfield": "#D2A24A",
  tvs: "#4D7CFF",
  hero: "#FF4D4D",
  haojue: "#3FA0FF",
  keeway: "#37C46B",
  lifan: "#2E86FF",
  loncin: "#FF4D4D",
  zongshen: "#FF4D4D",
  dayun: "#FF4D4D",
  dayang: "#FF4D4D",
  wuyang: "#FF4D4D",
  kymco: "#19B6B6",
  sym: "#4D7CFF",
  genesis: "#FF8A3C",
  freedom: "#4D7CFF",
  sukida: "#FF4D4D",
  serpento: "#FF4D4D",
  yumbo: "#FF6A00",
  akt: "#FF4D4D",
  vento: "#4D7CFF",
  avanti: "#FF6A00",
  dinamo: "#4D7CFF",
  "black panther": "#C9D2FF",
  future: "#19B6B6",
};

const BRAND_ALIASES = {
  "cf-moto": "cfmoto",
  "cfmoto": "cfmoto",
  "cf moto": "cfmoto",
  "harley davidson": "harley",
  "harley-davidson": "harley",
  "royal-enfield": "royal enfield",
  "black-panther": "black panther",
};

export function normalizeMotoBrandKey(brand) {
  const raw = String(brand || "").trim().toLowerCase();
  if (!raw) return null;
  if (BRAND_ALIASES[raw]) return BRAND_ALIASES[raw];
  if (BRAND_COLORS[raw]) return raw;
  const aliasHit = Object.keys(BRAND_ALIASES).find((k) => raw.includes(k));
  if (aliasHit) return BRAND_ALIASES[aliasHit];
  const colorHit = Object.keys(BRAND_COLORS).find((k) => raw.includes(k));
  return colorHit || raw;
}

export function getBrandColor(brand) {
  const key = normalizeMotoBrandKey(brand);
  if (!key) return "var(--orange)";
  if (BRAND_COLORS[key]) return BRAND_COLORS[key];
  const hit = Object.keys(BRAND_COLORS).find((k) => key.includes(k));
  return hit ? BRAND_COLORS[hit] : "var(--orange)";
}

/** Slug de archivo en /public/brands/{slug}.svg */
const BRAND_SLUG = {
  honda: "honda",
  suzuki: "suzuki",
  bajaj: "bajaj",
  italika: "italika",
  yamaha: "yamaha",
  ktm: "ktm",
  kawasaki: "kawasaki",
  cfmoto: "cfmoto",
  ducati: "ducati",
  bmw: "bmw",
  benelli: "benelli",
  aprilia: "aprilia",
  triumph: "triumph",
  harley: "harley",
  husqvarna: "husqvarna",
  "royal enfield": "royal-enfield",
  tvs: "tvs",
  hero: "hero",
  haojue: "haojue",
  keeway: "keeway",
  lifan: "lifan",
  loncin: "loncin",
  zongshen: "zongshen",
  dayun: "dayun",
  dayang: "dayang",
  wuyang: "wuyang",
  kymco: "kymco",
  sym: "sym",
  genesis: "genesis",
  freedom: "freedom",
  sukida: "sukida",
  serpento: "serpento",
  yumbo: "yumbo",
  akt: "akt",
  vento: "vento",
  avanti: "avanti",
  dinamo: "dinamo",
  "black panther": "black-panther",
  future: "future",
};

const BRAND_LOGO_BG = {
  bmw: "#ffffff",
  hero: "#ffffff",
  honda: "#ffffff",
  suzuki: "#ffffff",
  ktm: "#ffffff",
  ducati: "#ffffff",
  yamaha: "#ffffff",
};

export function brandLogoSlug(brand) {
  const key = normalizeMotoBrandKey(brand);
  if (!key) return null;
  if (BRAND_SLUG[key]) return BRAND_SLUG[key];
  const hit = Object.keys(BRAND_SLUG).find((k) => key.includes(k));
  return hit ? BRAND_SLUG[hit] : null;
}

export function brandLogoSrc(brand) {
  const slug = brandLogoSlug(brand);
  return slug ? `/brands/${slug}.svg` : null;
}

export function brandLogoBg(brand) {
  const slug = brandLogoSlug(brand);
  return (slug && BRAND_LOGO_BG[slug]) || "transparent";
}
