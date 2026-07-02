// Rasterize the app icon to the PNG sizes iOS / PWA installs expect.
// Run with: node scripts/gen-icons.mjs
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "public");

const BG = "#0f1115";
const FG = "#5b8cff";

// The dumbbell mark, centered in a 512 viewBox.
const mark = `
  <rect x="96" y="232" width="320" height="48" rx="12" fill="${FG}"/>
  <rect x="120" y="176" width="56" height="160" rx="16" fill="${FG}"/>
  <rect x="336" y="176" width="56" height="160" rx="16" fill="${FG}"/>
  <rect x="72" y="208" width="40" height="96" rx="14" fill="${FG}"/>
  <rect x="400" y="208" width="40" height="96" rx="14" fill="${FG}"/>
`;

// Full-bleed with rounded corners (used for "any" + apple-touch; the OS
// applies its own rounding on top, which is fine).
const anyIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BG}"/>
  ${mark}
</svg>`;

// Maskable: full-bleed background, mark scaled into the ~80% safe zone so the
// platform's circular/rounded mask never clips the dumbbell.
const maskableIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(256 256) scale(0.62) translate(-256 -256)">${mark}</g>
</svg>`;

const jobs = [
  { svg: anyIcon, size: 192, file: "icon-192.png" },
  { svg: anyIcon, size: 512, file: "icon-512.png" },
  { svg: maskableIcon, size: 512, file: "icon-512-maskable.png" },
  { svg: anyIcon, size: 180, file: "apple-touch-icon.png" },
];

for (const { svg, size, file } of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(out, file));
  console.log(`✓ ${file} (${size}×${size})`);
}
