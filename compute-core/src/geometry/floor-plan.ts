import type { Room } from '../types.ts';

/**
 * План пола: прямоугольник в масштабе + подписи размеров. ТРИВИАЛЬНО — это не
 * solver (см. design.md, Risk #2: план полов = тривиально, раскладка плитки = фаза 2).
 * Возвращает строку SVG (рендерится и в браузере, и в headless для PDF).
 */
export function floorPlanSvg(room: Room, pxPerM = 100, pad = 30): string {
  const w = room.lengthM * pxPerM;
  const h = room.widthM * pxPerM;
  const totalW = w + pad * 2;
  const totalH = h + pad * 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`,
    `  <rect x="${pad}" y="${pad}" width="${w}" height="${h}" fill="#f5f5f4" stroke="#1c1917" stroke-width="2"/>`,
    `  <text x="${pad + w / 2}" y="${pad - 8}" text-anchor="middle" font-family="sans-serif" font-size="14">${room.lengthM} м</text>`,
    `  <text x="${pad - 8}" y="${pad + h / 2}" text-anchor="middle" font-family="sans-serif" font-size="14" transform="rotate(-90 ${pad - 8} ${pad + h / 2})">${room.widthM} м</text>`,
    `  <text x="${pad + w / 2}" y="${pad + h / 2}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#78716c">${room.name}</text>`,
    `</svg>`,
  ].join('\n');
}
