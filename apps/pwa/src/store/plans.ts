// План своего объекта (D12a): фото/скан дизайн-проекта Blob'ом в IndexedDB.
// Один план на проект, replace при повторной загрузке (история не нужна —
// это референс для глаза, не данные расчёта).

import { getDb, type PlanDoc } from './db';

export async function getPlan(projectId: string): Promise<PlanDoc | undefined> {
  const db = await getDb();
  return db.get('plans', projectId);
}

export async function savePlan(doc: PlanDoc): Promise<void> {
  const db = await getDb();
  await db.put('plans', doc);
}

export async function deletePlan(projectId: string): Promise<void> {
  const db = await getDb();
  await db.delete('plans', projectId);
}
