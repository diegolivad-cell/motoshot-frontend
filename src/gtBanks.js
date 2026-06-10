/** Bancos de Guatemala — lista alineada con selectores de transferencia local. */
export const GT_BANKS = [
  "Banco de Antigua",
  "Banco Azteca",
  "BAC",
  "BAM",
  "Banrural",
  "Bantrab",
  "Cred. Hip. Nacional",
  "Citibank",
  "Banco Credicorp",
  "Ficohsa",
  "G&T Continental",
  "Banco de Guatemala",
  "Banco Industrial",
  "Banco Inmobiliario",
  "InterBanco",
  "Banco Inv S.A",
  "Banco Nexa",
  "Promerica",
  "Vivibanco",
  "Otro",
];

const BANK_SLUG = {
  "Banco de Antigua": "banco-de-antigua",
  "Banco Azteca": "banco-azteca",
  BAC: "bac",
  BAM: "bam",
  Banrural: "banrural",
  Bantrab: "bantrab",
  "Cred. Hip. Nacional": "cred-hip-nacional",
  Citibank: "citibank",
  "Banco Credicorp": "banco-credicorp",
  Ficohsa: "ficohsa",
  "G&T Continental": "gt-continental",
  "Banco de Guatemala": "banco-de-guatemala",
  "Banco Industrial": "banco-industrial",
  "Banco Inmobiliario": "banco-inmobiliario",
  InterBanco: "interbanco",
  "Banco Inv S.A": "banco-inv",
  "Banco Nexa": "banco-nexa",
  Promerica: "promerica",
  Vivibanco: "vivibanco",
  Otro: "otro",
};

const BANK_LOGO_EXT = {
  otro: "svg",
};

const BANK_LOGO_BG = {
  vivibanco: "#000000",
};

/** Nombres guardados antes del cambio de lista corta. */
const BANK_ALIASES = {
  "Banco de América Central": "BAC",
  "Banco Agromercantil": "BAM",
  "Banco G&T Continental": "G&T Continental",
  "Banco Promerica": "Promerica",
  "Banco Ficohsa": "Ficohsa",
};

export function normalizeBankName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  if (BANK_ALIASES[trimmed]) return BANK_ALIASES[trimmed];
  if (GT_BANKS.includes(trimmed)) return trimmed;
  return trimmed;
}

export function bankLogoBg(bank) {
  const normalized = normalizeBankName(bank);
  const slug = BANK_SLUG[normalized];
  return (slug && BANK_LOGO_BG[slug]) || "#ffffff";
}

export function bankLogoSrc(bank) {
  const normalized = normalizeBankName(bank);
  const slug = BANK_SLUG[normalized];
  if (!slug) return null;
  const ext = BANK_LOGO_EXT[slug] || "png";
  return `/banks/${slug}.${ext}`;
}

export function isKnownBank(name) {
  const normalized = normalizeBankName(name);
  return GT_BANKS.includes(normalized) && normalized !== "Otro";
}

export function isListedBank(name) {
  return isKnownBank(name);
}
