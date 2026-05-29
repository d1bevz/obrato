// Публичный API compute-core. UI (PWA) и headless-генератор PDF импортируют отсюда.
export * from './types.ts';
export * from './stages.ts';
export * from './pipeline.ts';

export { requirementsForRoom, floorAreaM2, wallAreaM2, ceilingAreaM2, floorPerimeterM } from './norms/compute-quantities.ts';
export { STARTER_NORMS } from './norms/norms-table.ts';
export type { NormRule } from './norms/norms-table.ts';
export { packsNeeded } from './packaging/round-to-packages.ts';
export { assemblePurchaseList } from './purchase/assemble-list.ts';
export { floorPlanSvg } from './geometry/floor-plan.ts';
export { naiveTileGrid } from './geometry/tile-layout.ts';
export type { TileLayout } from './geometry/tile-layout.ts';
export { SAMPLE_CATALOG } from './catalog/sample-catalog.ts';
export { electricPointsFor, ELECTRIC_TEMPLATES } from './electric/point-templates.ts';
export type { ElectricPoints } from './electric/point-templates.ts';
