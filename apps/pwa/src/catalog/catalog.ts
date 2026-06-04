// Каталог: bundled read-only снапшот seed.json (141 SKU, D10 — ре-курация
// руками перед объектом). Источник: compute-core/src/catalog/seed.json
// (курация 2026-05-30, Leroy Merlin PT + локальные). Проекции:
// MaterialView (имена/цены для UI) и CatalogInput (SkuView'ы Границы A —
// app резолвит default SKU и текущую цену ДО вызова ядра, гл.09 §2).

import type { CatalogInput, MaterialKey, UnitKey } from 'compute-wasm';
import seed from './seed.json';

// --- Типы строк seed.json (зеркало схемы каталога, гл.10 §2) ---

interface SeedMaterial {
  id: string;
  key: string;
  name: string;
  category: string;
  base_unit: string;
  variability: string;
  default_sku_id: string;
  active: boolean;
}

interface SeedSku {
  id: string;
  material_id: string;
  store_id: string;
  title: string;
  brand: string | null;
  store_sku: string | null;
  pack_size: number;
  pack_unit: string;
  coverage_per_pack: number | null;
  url: string | null;
  active: boolean;
}

interface SeedPrice {
  id: string;
  sku_id: string;
  amount_minor_units: number;
  currency: string;
  captured_at: string;
  source: string;
  source_ref: string | null;
  is_estimate: boolean;
}

interface SeedStore {
  id: string;
  key: string;
  name: string;
  kind: string;
  region: string;
  url: string | null;
  currency: string;
  priority_rank: number;
  active: boolean;
}

// --- Проекция для UI ---

export interface SkuView {
  id: string;
  title: string;
  brand: string | null;
  storeName: string;
  packSize: number;
  packUnit: string;
  /** Для упаковок, чья единица ≠ base_unit (банка «шт» на N м²); в seed v2 пусто. */
  coveragePerPack: number | null;
  url: string | null;
}

export interface PriceView {
  /** Цена за упаковку, центы EUR (integer money, гл.09 §2). */
  amountMinorUnits: number;
  currency: string;
  capturedAt: string;
  /** Цены пилота — всегда «ориентир» (D10): ручная курация, не live-фид. */
  isEstimate: boolean;
}

export interface MaterialView {
  key: MaterialKey;
  /** Русское имя (до « / ») из каталога. */
  nameRu: string;
  /** Португальское имя (после « / ») — как искать в магазине. */
  namePt: string | null;
  baseUnit: string;
  defaultSku: SkuView | null;
  price: PriceView | null;
  /** Цена за base_unit в центах (через pack_size/coverage), null если нет цены. */
  unitPriceMinor: number | null;
}

const materials = seed.materials as SeedMaterial[];
const skus = seed.skus as SeedSku[];
const prices = seed.prices as SeedPrice[];
const stores = seed.stores as SeedStore[];

const storeById = new Map(stores.map((s) => [s.id, s]));
const skuById = new Map(skus.map((s) => [s.id, s]));

/** Текущая цена SKU = max(captured_at) — Price insert-only (гл.10). */
function currentPrice(skuId: string): SeedPrice | null {
  let best: SeedPrice | null = null;
  for (const p of prices) {
    if (p.sku_id !== skuId) continue;
    if (!best || p.captured_at > best.captured_at) best = p;
  }
  return best;
}

/** Кол-во base_unit в одной упаковке (unit-инвариант гл.09 §2). */
function packCoverage(sku: SeedSku, baseUnit: string): number | null {
  if (sku.pack_unit === baseUnit) return sku.pack_size;
  if (sku.coverage_per_pack != null) return sku.coverage_per_pack;
  return null; // ядро на P3 такие SkuView отвергнет; UI цены не считает
}

function toMaterialView(m: SeedMaterial): MaterialView {
  const [nameRu, namePt] = m.name.split(' / ', 2);
  const sku = skuById.get(m.default_sku_id) ?? null;
  const price = sku ? currentPrice(sku.id) : null;
  const coverage = sku ? packCoverage(sku, m.base_unit) : null;
  return {
    key: m.key as MaterialKey,
    nameRu: nameRu ?? m.name,
    namePt: namePt ?? null,
    baseUnit: m.base_unit,
    defaultSku: sku && {
      id: sku.id,
      title: sku.title,
      brand: sku.brand,
      storeName: storeById.get(sku.store_id)?.name ?? '—',
      packSize: sku.pack_size,
      packUnit: sku.pack_unit,
      coveragePerPack: sku.coverage_per_pack,
      url: sku.url,
    },
    price: price && {
      amountMinorUnits: price.amount_minor_units,
      currency: price.currency,
      capturedAt: price.captured_at,
      isEstimate: price.is_estimate,
    },
    unitPriceMinor:
      price && coverage ? price.amount_minor_units / coverage : null,
  };
}

/** Проекция каталога: material key → default SKU + текущая цена. */
export const CATALOG: ReadonlyMap<MaterialKey, MaterialView> = new Map(
  materials.filter((m) => m.active).map((m) => [m.key as MaterialKey, toMaterialView(m)]),
);

export const CATALOG_VERSION: string = seed.catalog_version as string;

/** Каталог-вью Границы A: default SKU + текущая цена на материал.
 * Считается один раз — каталог бандлится и не меняется в рантайме. */
export const CATALOG_INPUT: CatalogInput = {
  catalogVersion: CATALOG_VERSION,
  skus: materials
    .filter((m) => m.active)
    .flatMap((m) => {
      const sku = skuById.get(m.default_sku_id);
      if (!sku) return [];
      const price = currentPrice(sku.id);
      return [
        {
          materialKey: m.key as MaterialKey,
          skuId: sku.id,
          packSize: sku.pack_size,
          packUnit: sku.pack_unit as UnitKey,
          ...(sku.coverage_per_pack != null
            ? { coveragePerPack: sku.coverage_per_pack }
            : {}),
          ...(price ? { priceMinorUnits: price.amount_minor_units } : {}),
        },
      ];
    }),
};
