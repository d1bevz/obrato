import type { Project, PurchaseList, Sku } from './types.ts';
import { requirementsForRoom } from './norms/compute-quantities.ts';
import { assemblePurchaseList } from './purchase/assemble-list.ts';
import { floorPlanSvg } from './geometry/floor-plan.ts';

export interface ProjectOutput {
  purchaseList: PurchaseList;
  floorPlans: { roomId: string; svg: string }[];
}

/**
 * Главный вход движка: проект (комнаты + состав работ + размеры) -> лист закупок
 * по этапам + планы полов. Это та "половина приложения", от которой зависит,
 * работает продукт или нет (design.md). UI её только отображает.
 */
export function buildProjectOutput(project: Project, catalog: Record<string, Sku>): ProjectOutput {
  const requirements = project.rooms.flatMap(requirementsForRoom);
  const purchaseList = assemblePurchaseList(project.id, requirements, catalog);
  const floorPlans = project.rooms.map((r) => ({ roomId: r.id, svg: floorPlanSvg(r) }));
  return { purchaseList, floorPlans };
}

/** Только лист закупок, без чертежей. */
export function buildPurchaseListForProject(project: Project, catalog: Record<string, Sku>): PurchaseList {
  return assemblePurchaseList(project.id, project.rooms.flatMap(requirementsForRoom), catalog);
}
