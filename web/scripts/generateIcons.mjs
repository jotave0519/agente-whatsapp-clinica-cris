/**
 * Gera os icones do PWA a partir de um SVG de marca (mesmo estilo visual do
 * .sidebar-brand-mark: gradiente rosa/marrom + "Z" em Instrument Serif).
 *
 * Preparado para trocar a identidade visual no futuro sem alterar codigo:
 * so substituir ICON_SVG abaixo (ou apontar pra um arquivo .svg externo) e
 * rodar `npm run icons:generate` de novo.
 *
 * Uso: node scripts/generateIcons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

const ICON_SVG = (size, radiusRatio = 0.22) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a76b63" />
      <stop offset="100%" stop-color="#7e4a44" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * radiusRatio}" fill="url(#g)" />
  <text
    x="50%"
    y="54%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${size * 0.52}"
    fill="#fbeee9"
  >Z</text>
</svg>`;

// Icone "maskable": marca menor centralizada numa area segura (Android recorta
// ate a borda em formatos variados - precisa de margem, senao a letra corta).
const MASKABLE_SVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a76b63" />
      <stop offset="100%" stop-color="#7e4a44" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)" />
  <text
    x="50%"
    y="54%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${size * 0.36}"
    fill="#fbeee9"
  >Z</text>
</svg>`;

const targets = [
  { name: "icon-192.png", size: 192, svg: ICON_SVG(192) },
  { name: "icon-512.png", size: 512, svg: ICON_SVG(512) },
  { name: "maskable-192.png", size: 192, svg: MASKABLE_SVG(192) },
  { name: "maskable-512.png", size: 512, svg: MASKABLE_SVG(512) },
  { name: "apple-touch-icon.png", size: 180, svg: ICON_SVG(180, 0) }, // iOS ja arredonda sozinho - cantos retos aqui
  { name: "favicon-32.png", size: 32, svg: ICON_SVG(32) },
  { name: "favicon-16.png", size: 16, svg: ICON_SVG(16) },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const t of targets) {
    const outPath = path.join(OUT_DIR, t.name);
    await sharp(Buffer.from(t.svg)).png().toFile(outPath);
    console.log("Gerado:", outPath);
  }
}

main().catch((err) => {
  console.error("Erro ao gerar icones:", err);
  process.exit(1);
});
