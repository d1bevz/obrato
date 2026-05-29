import type { MaterialRequirement, PurchaseItem, PurchaseList, Sku } from '../types.ts';
import { STAGES } from '../types.ts';
import { packsNeeded } from '../packaging/round-to-packages.ts';
import { round2 } from '../util.ts';

/**
 * Требования по материалам -> лист закупок, сгруппированный по этапам стройки
 * в каноническом порядке. Агрегирует по (этап + материал): материал на этап
 * покупается целиком, поэтому суммируем сырое количество и округляем ОДИН раз.
 */
export function assemblePurchaseList(
  projectId: string,
  requirements: MaterialRequirement[],
  catalog: Record<string, Sku>,
): PurchaseList {
  const agg = new Map<string, MaterialRequirement>();
  for (const r of requirements) {
    const key = `${r.stage}::${r.material}`;
    const existing = agg.get(key);
    if (existing) existing.rawQuantity = round2(existing.rawQuantity + r.rawQuantity);
    else agg.set(key, { ...r, roomId: 'aggregated' });
  }

  const items: PurchaseItem[] = [...agg.values()].map((r) => {
    const sku = catalog[r.material];
    if (!sku) throw new Error(`Нет SKU в каталоге для материала: ${r.material}`);
    const packs = packsNeeded(r.rawQuantity, sku.packSize);
    return { sku, stage: r.stage, rawQuantity: r.rawQuantity, unit: r.unit, packs, lineTotalEur: round2(packs * sku.priceEur) };
  });

  const byStage = STAGES.map((stage) => {
    const stageItems = items.filter((i) => i.stage === stage);
    const subtotalEur = round2(stageItems.reduce((s, i) => s + i.lineTotalEur, 0));
    return { stage, items: stageItems, subtotalEur };
  }).filter((g) => g.items.length > 0);

  const totalEur = round2(byStage.reduce((s, g) => s + g.subtotalEur, 0));
  return { projectId, byStage, totalEur };
}
