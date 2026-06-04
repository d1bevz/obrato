// ProcurementActual-операции (P4): insert-only сырьё калибровки —
// тройка estimate → actual → reconciliation копится онлайн (гл.13 §4).

import { getDb, type ActualDoc } from './db';
import { uuidv7 } from './uuid';

export type NewActual = Omit<
  ActualDoc,
  'id' | 'createdAt' | 'schemaVersion'
>;

export async function recordActual(input: NewActual): Promise<ActualDoc> {
  const doc: ActualDoc = {
    ...input,
    id: uuidv7(),
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  };
  const db = await getDb();
  await db.add('actuals', doc); // insert-only: правка = новая запись
  return doc;
}

export async function listActuals(snapshotId: string): Promise<ActualDoc[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('actuals', 'by-snapshot', snapshotId);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Последняя запись на позицию (materialKey × stage) — её читает отчёт;
 * история остаётся в сторе целиком. */
export function latestByLine(
  actuals: ActualDoc[],
): Map<string, ActualDoc> {
  const map = new Map<string, ActualDoc>();
  for (const a of actuals) {
    map.set(`${a.stage}:${a.materialKey}`, a); // вход отсортирован по createdAt
  }
  return map;
}
