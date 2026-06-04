// React-хуки стора: подписка через useSyncExternalStore, init — лениво.

import { useEffect, useSyncExternalStore } from 'react';
import type { ProjectDoc } from './db';
import {
  ensureStore,
  getInitError,
  getSnapshot,
  isReady,
  subscribe,
} from './projectStore';

export function useProjects(): {
  projects: ProjectDoc[];
  ready: boolean;
  storeError: string | null;
} {
  useEffect(() => {
    void ensureStore();
  }, []);
  const projects = useSyncExternalStore(subscribe, getSnapshot);
  const ready = useSyncExternalStore(subscribe, isReady);
  const storeError = useSyncExternalStore(subscribe, getInitError);
  return { projects, ready, storeError };
}

export function useProject(id: string | undefined): {
  project: ProjectDoc | null;
  ready: boolean;
  storeError: string | null;
} {
  const { projects, ready, storeError } = useProjects();
  return {
    project: id ? (projects.find((p) => p.id === id) ?? null) : null,
    ready,
    storeError,
  };
}
