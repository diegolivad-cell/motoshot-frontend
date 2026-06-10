import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/banks");

/** @type {Array<{ slug: string, url: string, crop?: "right" | "center" | "none", bg?: string }>} */
const BANKS = [
  { slug: "banco-de-antigua", url: "https://www.bantigua.com.gt/wp-content/uploads/2021/12/cropped-Elvis-icon-192x192.png", crop: "none" },
  { slug: "banco-azteca", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bancoazteca.com.gt&size=256" },
  { slug: "bac", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://baccredomatic.com&size=256" },
  { slug: "bam", url: "https://www.bam.com.gt/icons/icon-256x256.png?v=5699db4a512c73b3ff63e50a1aa575d0", crop: "none" },
  { slug: "banrural", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://banrural.com.gt&size=256" },
  { slug: "bantrab", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bantrab.com.gt&size=256" },
  { slug: "cred-hip-nacional", url: "https://www.chn.com.gt/wp-content/uploads/2022/10/Recurso-3-1.png", crop: "center" },
  { slug: "citibank", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.citi.com&size=256" },
  { slug: "banco-credicorp", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bancocredicorp.gt&size=256" },
  { slug: "ficohsa", url: "https://www.google.com/s2/favicons?domain=ficohsa.com&sz=128", crop: "none" },
  { slug: "gt-continental", url: "https://assets.gtc.com.gt/uploads/04805a41-8bac-48fa-a8bc-6a60789c9982/original/gyt-logo.png", crop: "center" },
  { slug: "banco-de-guatemala", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://banguat.gob.gt&size=256" },
  { slug: "banco-industrial", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bi.com.gt&size=256" },
  {
    slug: "banco-inmobiliario",
    url: "https://www.google.com/s2/favicons?domain=banco-inmobiliario.com.gt&sz=128",
    crop: "none",
  },
  { slug: "interbanco", url: "https://www.interbanco.com.gt/wp-content/uploads/2024/09/cropped-favicon-192x192.png", crop: "none" },
  { slug: "banco-inv", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://inv.com.gt&size=256" },
  { slug: "banco-nexa", url: "https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://nexabanco.com&size=256" },
  { slug: "promerica", url: "https://www.bancopromerica.com.gt/media/770477/logobp_2018.png", crop: "center" },
  {
    slug: "vivibanco",
    url: "https://www.vivibanco.com.gt/wp-content/uploads/2025/06/vivibanco-logo-2025.png",
    crop: "right",
    bg: "#000000",
  },
];

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function toSquareIcon(input, { crop = "center", bg = "#ffffff" } = {}) {
  let img = sharp(input).ensureAlpha();
  const meta = await img.metadata();
  const { width = 0, height = 0 } = meta;
  if (!width || !height) throw new Error("invalid image");

  if (crop !== "none" && width !== height) {
    const side = Math.min(width, height);
    let left = Math.round((width - side) / 2);
    if (crop === "right") left = Math.max(0, width - side);
    img = img.extract({ left, top: Math.round((height - side) / 2), width: side, height: side });
  }

  return img
    .resize(256, 256, { fit: "contain", background: bg })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  for (const bank of BANKS) {
    const outPath = path.join(outDir, `${bank.slug}.png`);
    try {
      let buf;
      try {
        buf = await fetchBuffer(bank.url);
      } catch (fetchErr) {
        const localSvg = path.join(outDir, `${bank.slug}.svg`);
        if (fs.existsSync(localSvg)) {
          buf = fs.readFileSync(localSvg);
        } else {
          throw fetchErr;
        }
      }
      const square = await toSquareIcon(buf, bank);
      fs.writeFileSync(outPath, square);
      console.log(`OK ${bank.slug} (${square.length} bytes)`);
    } catch (err) {
      console.error(`FAIL ${bank.slug}: ${err.message}`);
    }
  }
}

main();
