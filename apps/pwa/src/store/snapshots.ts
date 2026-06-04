// PurchaseSnapshot-операции (P3, упрощённо): insert-only история «что взял
// в магазин» (гл.05 §5). Без реактивного кэша — снапшоты читаются
// per-screen (их немного и они иммутабельны).

import type { ComputeProjectResponse } from 'compute-wasm';
import { CATALOG } from '../catalog/catalog';
import { getDb, type ProjectDoc, type SnapshotDoc } from './db';
import { uuidv7 } from './uuid';

/** Названия SKU и имена магазинов by value — снапшот переживает ре-курацию
 * (магазин — тоже факт листа «куда идти», находка ревью обкатки v1). */
function freezeSkuMeta(response: ComputeProjectResponse): {
  titles: Record<string, string>;
  stores: Record<string, string>;
} {
  const titles: Record<string, string> = {};
  const stores: Record<string, string> = {};
  for (const g of response.purchase.byStage) {
    for (const item of g.items) {
      if (!item.skuId || titles[item.skuId]) continue;
      const sku = CATALOG.get(item.materialKey)?.defaultSku;
      if (sku && sku.id === item.skuId) {
        titles[item.skuId] = sku.title;
        stores[item.skuId] = sku.storeName;
      }
    }
  }
  return { titles, stores };
}

export async function createSnapshot(
  project: ProjectDoc,
  response: ComputeProjectResponse,
): Promise<SnapshotDoc> {
  const { titles, stores } = freezeSkuMeta(response);
  const doc: SnapshotDoc = {
    id: uuidv7(),
    orgId: project.orgId,
    projectId: project.id,
    projectTitle: project.title,
    scope: 'full_project',
    frozenList: response.purchase,
    skuTitles: titles,
    skuStores: stores,
    normSetLabel: response.normSetLabel,
    engineVersion: response.engineVersion,
    catalogVersion: response.purchase.catalogVersion,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  };
  const db = await getDb();
  // Insert-only (immutable history): add, не put — повторная запись с тем же
  // id упадёт, а не перезапишет.
  await db.add('snapshots', doc);
  return doc;
}

export async function listSnapshots(projectId: string): Promise<SnapshotDoc[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('snapshots', 'by-project', projectId);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSnapshot(
  id: string,
): Promise<SnapshotDoc | undefined> {
  const db = await getDb();
  return db.get('snapshots', id);
}
