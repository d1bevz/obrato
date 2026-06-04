// LayoutState-операции (P5): один документ на (проект × комната) —
// пин плитки + CutOverride'ы поверх recomputed baseline (гл.05 §6).

import { getDb, type LayoutDoc } from './db';

const key = (projectId: string, roomId: string) => `${projectId}:${roomId}`;

export async function getLayout(
  projectId: string,
  roomId: string,
): Promise<LayoutDoc | undefined> {
  const db = await getDb();
  return db.get('layouts', key(projectId, roomId));
}

export async function saveLayout(doc: LayoutDoc): Promise<void> {
  const db = await getDb();
  await db.put('layouts', doc, key(doc.projectId, doc.roomId));
}
