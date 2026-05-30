// Проекция §4-каталога (Material/Sku/Store/Price) -> плоский каталог движка
// (Record<MaterialKind, Sku>). Это app-слой из гл.05 §8: ядро не ходит в Store/Price-
// историю — получает уже выбранный SKU + текущую цену. На пилоте «выбор» = Material.
// default_sku_id; «текущая цена» = Price с максимальным captured_at.
//
// Здесь же — проверка ИНВАРИАНТА ПИЛОТА (pack_unit == base_unit, если нет
// coverage_per_pack): лучше упасть на загрузке, чем тихо ошибиться в округлении.

import seedJson from './seed.json' with { type: 'json' };
import type { CatalogSeed, CatalogPrice } from './seed-types.ts';
import type { MaterialKind, Sku } from '../types.ts';

export const SEED: CatalogSeed = seedJson as CatalogSeed;

/** Текущая цена SKU = наблюдение с максимальным captured_at (Price append-only). */
export function currentPriceFor(seed: CatalogSeed, skuId: string): CatalogPrice | undefined {
  let best: CatalogPrice | undefined;
  for (const p of seed.prices) {
    if (p.sku_id !== skuId) continue;
    if (!best || p.captured_at > best.captured_at) best = p;
  }
  return best;
}

/**
 * Проецирует курируемый §4-seed в каталог движка: по одному дефолтному SKU на
 * каждый активный Material (через default_sku_id) с текущей ориентир-ценой.
 * Бросает на нарушении ссылочной целостности или инварианта пилота.
 */
export function projectCatalog(seed: CatalogSeed): Record<MaterialKind, Sku> {
  const storeById = new Map(seed.stores.map((s) => [s.id, s]));
  const skuById = new Map(seed.skus.map((s) => [s.id, s]));
  const out: Partial<Record<MaterialKind, Sku>> = {};

  for (const m of seed.materials) {
    if (!m.active) continue;
    if (!m.default_sku_id) throw new Error(`Material ${m.key}: не задан default_sku_id`);

    const csku = skuById.get(m.default_sku_id);
    if (!csku) throw new Error(`Material ${m.key}: default_sku_id ${m.default_sku_id} не найден среди skus`);
    if (csku.material_id !== m.id)
      throw new Error(`Material ${m.key}: default_sku ${csku.id} принадлежит другому материалу (${csku.material_id})`);

    // Инвариант пилота: без conversion-факторов кросс-размерный SKU недопустим.
    if (csku.pack_unit !== m.base_unit && !csku.coverage_per_pack)
      throw new Error(
        `Sku ${csku.id}: pack_unit ${csku.pack_unit} != base_unit ${m.base_unit} материала ${m.key} без coverage_per_pack`,
      );

    const store = storeById.get(csku.store_id);
    if (!store) throw new Error(`Sku ${csku.id}: store ${csku.store_id} не найден`);

    const price = currentPriceFor(seed, csku.id);
    if (!price) throw new Error(`Sku ${csku.id}: нет ни одной цены`);

    out[m.key] = {
      id: csku.id,
      material: m.key,
      title: csku.title,
      packSize: csku.pack_size,
      packUnit: csku.pack_unit,
      priceEur: price.amount_minor_units / 100,
      store: store.key,
      url: csku.url,
    };
  }

  return out as Record<MaterialKind, Sku>;
}

/** Готовый каталог движка из глобального seed (замена прежней SAMPLE_CATALOG-заглушки). */
export const CATALOG: Record<MaterialKind, Sku> = projectCatalog(SEED);
