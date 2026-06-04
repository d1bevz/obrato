// ComputeClient — главный поток Границы A (гл.09 §2).
// Один worker на приложение; requestId-роутинг ответов; после паники ядра
// worker пересоздаётся (graceful error наружу, приложение живёт).
// Проекция Project → ProjectInput живёт ЗДЕСЬ (гл.09 §3 шаг 2): вниз уходят
// только чистые данные, а не вся app-сущность под прикрытием serde.

import type {
  ComputeProjectResponse,
  DrawingGeometry,
  ProjectInput,
  Room as RoomInput,
} from 'compute-wasm';
import { CATALOG_INPUT } from '../catalog/catalog';
import type { Project, Room } from '../types';
import type { ComputeRequest, ComputeResponse } from './protocol';

export class ComputeFailure extends Error {
  readonly kind: 'error' | 'panic';

  constructor(kind: 'error' | 'panic', message: string) {
    super(message);
    this.name = 'ComputeFailure';
    this.kind = kind;
  }
}

type Pending =
  | {
      kind: 'project';
      resolve: (r: ComputeProjectResponse) => void;
      reject: (e: ComputeFailure) => void;
    }
  | {
      kind: 'grid';
      resolve: (r: DrawingGeometry | null) => void;
      reject: (e: ComputeFailure) => void;
    };

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, Pending>();

function failAll(message: string) {
  for (const p of pending.values()) {
    p.reject(new ComputeFailure('error', message));
  }
  pending.clear();
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = (e: MessageEvent<ComputeResponse>) => {
    const msg = e.data;
    const p = pending.get(msg.requestId);
    if (!p) return; // ответ на superseded-запрос — уже никому не нужен
    pending.delete(msg.requestId);
    if (msg.status === 'ok' && p.kind === 'project') {
      p.resolve(msg.response);
    } else if (msg.status === 'ok-grid' && p.kind === 'grid') {
      p.resolve(msg.response);
    } else if (msg.status === 'ok' || msg.status === 'ok-grid') {
      p.reject(
        new ComputeFailure('error', 'протокол: вид ответа не совпал с запросом'),
      );
    } else {
      p.reject(new ComputeFailure(msg.status, msg.message));
      if (msg.status === 'panic') {
        // Инстанс WASM после паники отравлен — терминируем worker, а вместе
        // с ним валим и ВСЕ остальные in-flight запросы (их ответ уже не
        // придёт никогда); следующий запрос поднимет свежий инстанс.
        worker?.terminate();
        worker = null;
        failAll(`compute worker перезапущен после паники ядра: ${msg.message}`);
      }
    }
  };
  worker.onerror = (e) => {
    // Скрипт worker'а не поднялся (загрузка wasm и т.п.) — валим все запросы.
    worker?.terminate();
    worker = null;
    failAll(e.message || 'compute worker failed');
  };
  return worker;
}

/** Явная проекция комнаты: голая геометрия + состав работ, БЕЗ app-полей
 * (electricPoints, measurement_source, notes — гл.09 §2 «НЕ пересекает»). */
function roomToInput(r: Room): RoomInput {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    lengthM: r.lengthM,
    widthM: r.widthM,
    heightM: r.heightM,
    wet: r.wet,
    ...(r.wetZoneHeightM != null ? { wetZoneHeightM: r.wetZoneHeightM } : {}),
    openings: r.openings.map((o) => ({
      kind: o.kind,
      widthM: o.widthM,
      heightM: o.heightM,
    })),
    works: {
      ...(r.works.floor ? { floor: { ...r.works.floor } } : {}),
      ...(r.works.walls
        ? {
            walls: {
              ...(r.works.walls.paintCoats != null
                ? { paintCoats: r.works.walls.paintCoats }
                : {}),
              ...(r.works.walls.tilePattern != null
                ? { tilePattern: r.works.walls.tilePattern }
                : {}),
            },
          }
        : {}),
      ...(r.works.ceiling ? { ceiling: { ...r.works.ceiling } } : {}),
    },
  };
}

/** Проекция app-Project → ProjectInput (без address/status/sync). */
export function projectToInput(p: Project): ProjectInput {
  return {
    id: p.id,
    title: p.title,
    rooms: p.rooms.map(roomToInput),
  };
}

/** Проект → оценки + лист закупок. Эфемерно, recomputable (Грань A). */
export function computeEstimates(
  project: Project,
): Promise<ComputeProjectResponse> {
  const requestId = nextRequestId++;
  return new Promise<ComputeProjectResponse>((resolve, reject) => {
    pending.set(requestId, { kind: 'project', resolve, reject });
    const req: ComputeRequest = {
      requestId,
      kind: 'project',
      project: projectToInput(project),
      catalog: CATALOG_INPUT,
    };
    ensureWorker().postMessage(req);
  });
}

/** Naive grid пола В МЕТРАХ (S4). null — вырожденная геометрия. */
export function computeFloorGrid(params: {
  roomLengthM: number;
  roomWidthM: number;
  tileWM: number;
  tileHM: number;
}): Promise<DrawingGeometry | null> {
  const requestId = nextRequestId++;
  return new Promise<DrawingGeometry | null>((resolve, reject) => {
    pending.set(requestId, { kind: 'grid', resolve, reject });
    const req: ComputeRequest = { requestId, kind: 'grid', ...params };
    ensureWorker().postMessage(req);
  });
}
