// Персист P2 (гл.13 §2): IndexedDB напрямую через idb, document-level,
// single-device. Полный sync-движок (outbox, server-assigned revision,
// tombstones — гл.09 §4) сознательно НЕ строим; id-дисциплина (UUIDv7,
// org_id в типах) держится, чтобы миграция на бэкенд-синк не перелопачивала
// данные.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PurchaseListView } from 'compute-wasm';
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

/** PurchaseSnapshot (гл.05 §5, P3 упрощённо): иммутабельная заморозка листа
 * «взял в магазин». Воспроизводимость держится на frozen_list-blob (точный
 * Грань-A payload by value), НЕ на catalog_version-lookup. Insert-only. */
export interface SnapshotDoc {
  id: string;
  orgId: string;
  projectId: string;
  /** Денорм для заголовка снапшота (проект могут переименовать/удалить). */
  projectTitle: string;
  scope: 'full_project';
  frozenList: PurchaseListView;
  /** Названия SKU by value на момент freeze — рендер снапшота не зависит
   * от живого каталога (самодостаточность frozen_list, гл.05 §5). */
  skuTitles: Record<string, string>;
  normSetLabel: string;
  engineVersion: string;
  catalogVersion: string;
  createdAt: string;
  schemaVersion: 1;
}

interface ObratoDB extends DBSchema {
  projects: { key: string; value: ProjectDoc };
  meta: { key: string; value: OrgDoc | SeedMark };
  snapshots: {
    key: string;
    value: SnapshotDoc;
    indexes: { 'by-project': string };
  };
}

const DB_NAME = 'obrato';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ObratoDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ObratoDB>> {
  dbPromise ??= openDB<ObratoDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('projects', { keyPath: 'id' });
        // meta — out-of-line ключи ('org' и т.п.), значение несёт свой id.
        db.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        const snapshots = db.createObjectStore('snapshots', { keyPath: 'id' });
        snapshots.createIndex('by-project', 'projectId');
      }
    },
  });
  return dbPromise;
}
