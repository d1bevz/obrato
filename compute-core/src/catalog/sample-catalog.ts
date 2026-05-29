import type { MaterialKind, Sku } from '../types.ts';

/**
 * ЗАГЛУШКА-каталог для слайса. На пилоте заменяется КУРИРУЕМЫМ вручную каталогом
 * ~50-100 SKU, которые Давид реально берёт (Leroy PT + локальные магазины).
 * НЕ скрейпер на старте — см. design.md, Open Question Q2.
 * Цены и упаковки здесь — примерные, не реальные.
 */
export const SAMPLE_CATALOG: Record<MaterialKind, Sku> = {
  'floor-tile': { id: 'lp-floor-tile', material: 'floor-tile', title: 'Плитка пол 60×60 (короб)', packSize: 1.44, packUnit: 'm2', priceEur: 25, store: 'leroy-pt' },
  'wall-tile': { id: 'lp-wall-tile', material: 'wall-tile', title: 'Плитка стена 30×60 (короб)', packSize: 1.08, packUnit: 'm2', priceEur: 20, store: 'leroy-pt' },
  'tile-adhesive': { id: 'lp-adhesive', material: 'tile-adhesive', title: 'Клей плиточный C2TE (мешок 25 кг)', packSize: 25, packUnit: 'kg', priceEur: 12, store: 'leroy-pt' },
  'grout': { id: 'lp-grout', material: 'grout', title: 'Затирка (ведро 5 кг)', packSize: 5, packUnit: 'kg', priceEur: 9, store: 'leroy-pt' },
  'paint': { id: 'lp-paint', material: 'paint', title: 'Краска интерьерная (банка 5 л)', packSize: 5, packUnit: 'l', priceEur: 35, store: 'leroy-pt' },
  'primer': { id: 'lp-primer', material: 'primer', title: 'Грунтовка (канистра 5 л)', packSize: 5, packUnit: 'l', priceEur: 18, store: 'leroy-pt' },
  'screed-mix': { id: 'lp-screed', material: 'screed-mix', title: 'Смесь для стяжки (мешок 25 кг)', packSize: 25, packUnit: 'kg', priceEur: 6, store: 'leroy-pt' },
  'waterproofing': { id: 'lp-waterproof', material: 'waterproofing', title: 'Гидроизоляция обмазочная (ведро 5 кг)', packSize: 5, packUnit: 'kg', priceEur: 30, store: 'leroy-pt' },
  'baseboard': { id: 'lp-baseboard', material: 'baseboard', title: 'Плинтус МДФ (хлыст 2.5 м)', packSize: 2.5, packUnit: 'm', priceEur: 4, store: 'leroy-pt' },
};
