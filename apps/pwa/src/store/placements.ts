// Расстановка комнат на схеме (D12c): PlacementDoc per-project в IndexedDB.
// Презентационный слой — Граница A и расчёты от позиций не зависят.

import { getDb, type PlacementDoc } from './db';

export async function getPlacement(
  projectId: string,
): Promise<PlacementDoc | undefined> {
  const db = await getDb();
  return db.get('placements', projectId);
}

export async function savePlacement(doc: PlacementDoc): Promise<void> {
  const db = await getDb();
  await db.put('placements', doc);
}

/** Чистка позиции удалённой комнаты (зовётся из deleteRoom): orphan-id не
 * вредит рендеру (layoutRooms идёт от project.rooms), но мусорить
 * в персистентном доке не надо. Best-effort у вызывающего. */
export async function pruneRoomPosition(
  projectId: string,
  roomId: string,
): Promise<void> {
  const db = await getDb();
  const doc = await db.get('placements', projectId);
  if (!doc || !(roomId in doc.positions)) return;
  const positions = { ...doc.positions };
  delete positions[roomId];
  await db.put('placements', {
    ...doc,
    positions,
    updatedAt: new Date().toISOString(),
  });
}
