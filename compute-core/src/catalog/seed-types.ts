// Типы курируемого ГЛОБАЛЬНОГО каталога — зеркало гл.05 §4 (Material / Sku / Store / Price).
// Это форма seed-данных (compute-core/src/catalog/seed.json), которые грузятся в
// сервер/IndexedDB как глобальный read-only seed (org_id=null). Ядро их НЕ хранит —
// app-слой проецирует §4 в плоский набор для движка (см. project-seed.ts, гл.05 §8).
//
// Деньги — integer minor units (центы): без f64-drift на serde/WASM-границе (D10).
// Цена = ОРИЕНТИР: append-only, timestamped, sourced, is_estimate (D10).

import type { MaterialKind, Unit } from '../types.ts';

/** ISO-4217. На пилоте всегда EUR. */
export type Currency = 'EUR';

/** Магазин-вендор (гл.05 §4 Store). Курируемый, маленький, GLOBAL. */
export interface CatalogStore {
  id: string;
  /** slug, UNIQUE (leroy-pt, local). Проецируется в Sku.store движка. */
  key: 'leroy-pt' | 'local';
  name: string;
  /** chain=scrapeable/url; local=ручная цена. */
  kind: 'chain' | 'local' | 'online';
  region?: string;
  url?: string;
  currency: Currency;
  /** Куратор-преференс при равных (ниже = предпочтительнее). */
  priority_rank?: number;
  active: boolean;
}

/** Категория материала (гл.05 §4 Material.category). */
export type MaterialCategory =
  | 'tile'
  | 'adhesive'
  | 'grout'
  | 'paint'
  | 'primer'
  | 'screed'
  | 'waterproofing'
  | 'trim'
  | 'fastener'
  | 'other';

/** Интринсик-флаг вариативности (D7). screed/adhesive = high_variance. */
export type MaterialVariability = 'fixed' | 'ranged' | 'high_variance';

/** Курируемый ВИД материала (таксономия, гл.05 §4 Material). Ядро рассуждает о Material. */
export interface CatalogMaterial {
  id: string;
  /** Стабильный slug — join-ключ контракта ядра (NormRule.material / MaterialEstimate.material). */
  key: MaterialKind;
  /** Локализовано: «RU / PT». */
  name: string;
  category: MaterialCategory;
  /** Каноническая единица, в которой ядро квантует и норма (гл.07) выдаёт расход. */
  base_unit: Unit;
  variability: MaterialVariability;
  /** Куратор-пик авто-выбора. Null → fallback cheapest in-stock (на пилоте задан явно). */
  default_sku_id: string | null;
  active: boolean;
}

/** Диапазон укрывистости (escape-hatch coverage_per_pack). Зеркало NormValue. */
export interface CatalogCoverage {
  central: number;
  lo: number;
  hi: number;
  confidence: 'high' | 'medium' | 'low' | 'unvalidated';
}

/** Конкретный покупаемый ПРОДУКТ в конкретном магазине (гл.05 §4 Sku). */
export interface CatalogSku {
  id: string;
  material_id: string;
  store_id: string;
  /** Имя как на полке. */
  title: string;
  brand?: string;
  /** Код магазина (Leroy ref / EAN). */
  store_sku?: string;
  /** Сколько base-units Material в ОДНОМ паке (1.44 m²/коробка, 20 kg/мешок). */
  pack_size: number;
  /** ИНВАРИАНТ ПИЛОТА: pack_unit == Material.base_unit (если нет coverage_per_pack). */
  pack_unit: Unit;
  /** Escape-hatch для редкого SKU, где пак в иной размерности, чем base_unit. Null на пилоте. */
  coverage_per_pack?: CatalogCoverage | null;
  image_url?: string;
  url?: string;
  /** Курация (≠ availability). */
  active: boolean;
}

/** ОРИЕНТИР-наблюдение цены Sku (гл.05 §4 Price). Append-only, timestamped, sourced (D10). */
export interface CatalogPrice {
  id: string;
  sku_id: string;
  /** Цена за ПАК в центах (integer money — без f64-drift). */
  amount_minor_units: number;
  /** Денорм из Store для self-contained-историчности. */
  currency: Currency;
  /** Когда НАБЛЮДЕНА (не insert-time). current = max(captured_at) per Sku. */
  captured_at: string;
  source: 'manual_curator' | 'store_website' | 'receipt' | 'foreman_report' | 'scraper';
  source_ref?: string;
  /** true = guess/placeholder. На seed-пилоте все цены = ориентиры (true). */
  is_estimate: boolean;
}

/**
 * Конверт seed-данных каталога. Все строки ГЛОБАЛЬНЫЕ (org_id=null) и несут
 * catalog_version. Грузится как read-only seed; клиент почти не пишет (гл.05 §9).
 */
export interface CatalogSeed {
  catalog_version: string;
  stores: CatalogStore[];
  materials: CatalogMaterial[];
  skus: CatalogSku[];
  prices: CatalogPrice[];
}
