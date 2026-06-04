// Стор проектов: кэш над IndexedDB + подписка для React
// (useSyncExternalStore). Единственный источник истины для UI на клиенте
// (StoreProvider-минимум, гл.09 ③) — без SyncOutbox/SyncEngine (P2 —
// single-device, гл.13 §2).
//
// Инвариант мутаций: СНАЧАЛА запись в idb, ПОТОМ кэш+notify — UI не
// показывает состояние, которого нет на диске (находка ревью P2); отказ
// записи (quota, private mode) пробрасывается вызывающему для показа.

import { FLATPLAN_DEMO } from '../demo/flatplan';
import type { Project, Room } from '../types';
import { getDb, type OrgDoc, type ProjectDoc } from './db';
import { uuidv7 } from './uuid';

let cache = new Map<string, ProjectDoc>();
let org: OrgDoc | null = null;
let ready = false;
let initError: string | null = null;
let snapshot: ProjectDoc[] = [];
const listeners = new Set<() => void>();

function rebuildSnapshot() {
  snapshot = [...cache.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

function notify() {
  rebuildSnapshot();
  for (const l of listeners) l();
}

/** Инициализация: загрузка кэша; на fresh install — silent auto-create Org
 * (BootstrapProvisioner-минимум) + однократный seed демо-квартиры
 * (гл.13 §0 п.5; маркер 'seeded' — удалённое демо не воскресает). */
async function init(): Promise<void> {
  const db = await getDb();
  org = ((await db.get('meta', 'org')) as OrgDoc | undefined) ?? null;
  if (!org) {
    org = {
      id: uuidv7(),
      kind: 'solo',
      region: 'PT',
      currency: 'EUR',
      createdAt: new Date().toISOString(),
    };
    await db.put('meta', org, 'org');
  }

  const all = await db.getAll('projects');
  cache = new Map(all.map((p) => [p.id, p]));

  const seeded = await db.get('meta', 'seeded');
  if (!seeded && cache.size === 0) {
    const demo: ProjectDoc = {
      ...FLATPLAN_DEMO,
      orgId: org.id,
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    await db.put('projects', demo);
    await db.put('meta', { seededAt: new Date().toISOString() }, 'seeded');
    cache.set(demo.id, demo);
  }

  ready = true;
  notify();
}

let initPromise: Promise<void> | null = null;

export function ensureStore(): Promise<void> {
  initPromise ??= init().catch((e: unknown) => {
    // Private mode / quota / SecurityError: показываем, а не вечное
    // «Загружаю…»; сбрасываем промис — повторный маунт повторит попытку.
    initError = e instanceof Error ? e.message : String(e);
    initPromise = null;
    notify();
  });
  return initPromise;
}

// --- Подписка (контракт useSyncExternalStore) ---

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): ProjectDoc[] {
  return snapshot;
}

export function isReady(): boolean {
  return ready;
}

export function getInitError(): string | null {
  return initError;
}

// --- Мутации (idb-сначала; кэш+notify — после успешной записи) ---

async function persist(doc: ProjectDoc): Promise<void> {
  const db = await getDb();
  await db.put('projects', doc);
  cache.set(doc.id, doc);
  notify();
}

function touch(p: ProjectDoc): ProjectDoc {
  return { ...p, updatedAt: new Date().toISOString() };
}

export async function createProject(title: string): Promise<ProjectDoc> {
  if (!org) throw new Error('store не инициализирован');
  const doc: ProjectDoc = {
    id: uuidv7(),
    orgId: org.id,
    title,
    status: 'planning',
    rooms: [],
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  };
  await persist(doc);
  return doc;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'title' | 'address' | 'status'>>,
): Promise<void> {
  const p = cache.get(id);
  if (!p) return;
  await persist(touch({ ...p, ...patch }));
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('projects', id);
  cache.delete(id);
  notify();
}

export async function upsertRoom(projectId: string, room: Room): Promise<void> {
  const p = cache.get(projectId);
  if (!p) return;
  const idx = p.rooms.findIndex((r) => r.id === room.id);
  const rooms =
    idx >= 0
      ? p.rooms.map((r) => (r.id === room.id ? room : r))
      : [...p.rooms, room];
  await persist(touch({ ...p, rooms }));
}

export async function deleteRoom(
  projectId: string,
  roomId: string,
): Promise<void> {
  const p = cache.get(projectId);
  if (!p) return;
  await persist(touch({ ...p, rooms: p.rooms.filter((r) => r.id !== roomId) }));
}
