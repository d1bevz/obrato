import { round2 } from '../util.ts';

export interface TileLayout {
  cols: number;
  rows: number;
  tilesNaive: number;
  note: string;
  svg: string;
}

/**
 * ЧЕРНОВАЯ раскладка: наивная сетка от угла. БЕЗ балансировки подрезки, выбора
 * датума, обхода проёмов/сантехники, паттернов — это rules-based solver, ФАЗА 2
 * (design.md, Risk #2). Здесь только грубый счёт плиток и сетка для превью,
 * явно помеченная как черновая. Для дозакупки плитки опирайся на нормы (floor-tile
 * по площади), а не на этот счёт — он завышает на подрезке.
 */
export function naiveTileGrid(
  surfaceWidthM: number,
  surfaceHeightM: number,
  tileWidthM: number,
  tileHeightM: number,
  pxPerM = 100,
): TileLayout {
  const cols = Math.ceil(surfaceWidthM / tileWidthM);
  const rows = Math.ceil(surfaceHeightM / tileHeightM);
  const tilesNaive = cols * rows;

  const w = round2(surfaceWidthM * pxPerM);
  const h = round2(surfaceHeightM * pxPerM);
  const tw = tileWidthM * pxPerM;
  const th = tileHeightM * pxPerM;

  const lines: string[] = [];
  for (let c = 0; c <= cols; c++) {
    const x = round2(Math.min(c * tw, w));
    lines.push(`  <line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#a8a29e" stroke-width="1"/>`);
  }
  for (let r = 0; r <= rows; r++) {
    const y = round2(Math.min(r * th, h));
    lines.push(`  <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#a8a29e" stroke-width="1"/>`);
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `  <rect x="0" y="0" width="${w}" height="${h}" fill="#fafaf9"/>`,
    ...lines,
    `</svg>`,
  ].join('\n');

  return {
    cols,
    rows,
    tilesNaive,
    note: 'ЧЕРНОВАЯ раскладка — без балансировки подрезки (solver = фаза 2)',
    svg,
  };
}
