#!/usr/bin/env node
/**
 * Renders the mini program icons from inline SVG (WeUI-style 1.5px outline,
 * 24px grid) to PNG, because tabBar and <image> need bitmap files.
 * Requires `rsvg-convert` (brew install librsvg).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "miniprogram", "assets");
const GREEN = "#07C160";
const INK = "#191919";

const icons = {
  overview: '<path d="M4 15.5V12l1.8-4.6A2 2 0 0 1 7.7 6h8.6a2 2 0 0 1 1.9 1.4L20 12v3.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 12h16"/><circle cx="7.5" cy="14.2" r=".6" fill="C"/><circle cx="16.5" cy="14.2" r=".6" fill="C"/><path d="M6 16.5V18M18 16.5V18"/>',
  drives: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16"/>',
  charges: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3z"/>',
  parking: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M10 17V8h3.2a2.6 2.6 0 0 1 0 5.2H10"/>',
  mine: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',
  sync: '<path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9"/><path d="M18 3.5v3.8h-3.8M6 20.5v-3.8h3.8"/>',
  signal: '<path d="M12 13v8"/><circle cx="12" cy="11" r="1.6"/><path d="M8.2 7.2a5.4 5.4 0 0 0 0 7.6M15.8 7.2a5.4 5.4 0 0 1 0 7.6M5.3 4.3a9.5 9.5 0 0 0 0 13.4M18.7 4.3a9.5 9.5 0 0 1 0 13.4"/>',
  bolt: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3z"/>',
  plug: '<path d="M9 3v4M15 3v4M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0V7zM12 16v5"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3"/><path d="M6 10v4M9 10v4M12 10v4"/>',
  road: '<path d="M8 3 4 21M16 3l4 18M12 4v3M12 10.5v3M12 17v3"/>',
  gauge: '<path d="M4.2 17a8.5 8.5 0 1 1 15.6 0"/><path d="m12 13 4-4.5"/><circle cx="12" cy="13" r="1.2"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  home: '<path d="m3.5 11 8.5-7 8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4.2l2.6 1.6M9.5 3h5"/>',
  chart: '<path d="M4 4v16h16"/><path d="m7.5 14.5 3.5-4 3 2.5 5-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/><circle cx="12" cy="12" r="6.3"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/><path d="M7.5 12h2.5l1.2-2 1.8 4 1.2-2h2.3"/>',
  map: '<path d="M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  rhythm: '<path d="M3 12h3.5l2-5 3.5 10 2.5-7 1.5 2H21"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  wifi: '<path d="M2.8 9a13 13 0 0 1 18.4 0M5.9 12.3a8.6 8.6 0 0 1 12.2 0M9 15.6a4.2 4.2 0 0 1 6 0"/><circle cx="12" cy="18.8" r="1" fill="C"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'
};

const svg = (body, color, size = 24, strokeWidth = 1.6) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body.replaceAll('fill="C"', `fill="${color}"`)}</svg>`;

function render(name, content, pixels) {
  const output = join(root, name);
  mkdirSync(dirname(output), { recursive: true });
  const png = execFileSync("rsvg-convert", ["-w", String(pixels), "-h", String(pixels), "-f", "png"], { input: content });
  writeFileSync(output, png);
}

for (const name of ["overview", "drives", "charges", "parking", "mine"]) {
  render(`tab/${name}.png`, svg(icons[name], INK, 24, 1.5), 81);
  render(`tab/${name}-active.png`, svg(icons[name], GREEN, 24, 1.8), 81);
}
for (const [name, body] of Object.entries(icons)) {
  if (["overview", "drives", "charges", "parking", "mine"].includes(name)) continue;
  render(`icons/${name}.png`, svg(body, GREEN), 96);
}
render("icons/marker.png", `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34"><path d="M14 33S2 21.6 2 13a12 12 0 0 1 24 0c0 8.6-12 20-12 20z" fill="${GREEN}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>`, 84);
render("icons/route-start.png", `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="7" fill="${GREEN}" stroke="#fff" stroke-width="3"/></svg>`, 54);
render("icons/route-end.png", `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="7" fill="#10AEFF" stroke="#fff" stroke-width="3"/></svg>`, 54);
render("icons/logo.png", `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect width="56" height="56" rx="12" fill="${GREEN}"/><g transform="translate(10 10) scale(1.5)" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons.overview.replaceAll('fill="C"', 'fill="#fff"')}</g></svg>`, 168);
console.log(`Rendered icons into ${root}`);
