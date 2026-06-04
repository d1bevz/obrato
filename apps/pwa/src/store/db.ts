// Персист P2 (гл.13 §2): IndexedDB напрямую через idb, document-level,
// single-device. Полный sync-движок (outbox, server-assigned revision,
// tombstones — гл.09 §4) сознательно НЕ строим; id-дисциплина (UUIDv7,
// org_id в типах) держится, чтобы миграция на бэкенд-синк не перелопачивала
// данные.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project } from '../types';

/** Документ проекта = app-Project + tenancy/служебные поля (Грань B-минимум). */
export interface ProjectDoc extends Project {
  orgId: string;
  updatedAt: string; // ISO
  schemaVersion: 1;
}

/** Локальная identity (BootstrapProvisioner-минимум, гл.09 ③): silent
 * auto-create Org на fresh install, чтобы owned-строки сразу имели org_id. */
export interface OrgDoc {
  id: string;
  kind: 'solo';
  region: 'PT';
  currency: 'EUR';
  createdAt: string;
}

/** Маркер «демо уже сеяли» — удалённое демо не воскресает (ключ 'seeded'). */
export interface SeedMark {
  seededAt: string;
}

interface ObratoDB extends DBSchema {
  projects: { key: string; value: ProjectDoc };
  meta: { key: string; value: OrgDoc | SeedMark };
}

const DB_NAME = 'obrato';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ObratoDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ObratoDB>> {
  dbPromise ??= openDB<ObratoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('projects', { keyPath: 'id' });
      // meta — out-of-line ключи ('org' и т.п.), значение несёт свой id.
      db.createObjectStore('meta');
    },
  });
  return dbPromise;
}
