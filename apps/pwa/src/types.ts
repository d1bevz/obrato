// View-типы приложения. С P1 модель ввода едет ИЗ RUST (crates/compute-wasm,
// tsify, D3/D4) — ручного зеркала больше нет: меняешь поле в Rust → здесь
// перестаёт компилиться. App-слой добавляет только своё: электрика-точки
// (шаблоны, вне 10 материалов ядра) и метаданные проекта (address/status).

import type {
  FloorFinish,
  Opening,
  OpeningKind,
  Room as CoreRoom,
  RoomType,
  Works as CoreWorks,
} from 'compute-wasm';

export type { Confidence, FloorFinish, LayoutPattern, MaterialEstimate, MaterialKey, NormValue, Opening, OpeningKind, RoomType, StageKey, UnitKey } from 'compute-wasm';

/** Точки электрики — app-слой (счётчики по шаблонам, гл.02 MVP п.2). */
export interface ElectricPoints {
  sockets: number;
  switches: number;
  lights: number;
}

/** Состав работ комнаты = ядро + app-слой (электрика). */
export interface Works extends CoreWorks {
  electricPoints?: ElectricPoints;
}

/** Комната = модель ядра + app-расширение works; для ввода wasm openings/works
 * опциональны (serde default), в app-слое — обязательны (строгость форм). */
export interface Room extends Omit<CoreRoom, 'works' | 'openings'> {
  openings: Opening[];
  works: Works;
}

export interface Project {
  id: string;
  title: string;
  address?: string;
  status: 'planning' | 'active' | 'done';
  rooms: Room[];
  /** Бандл-страницы плана дизайн-проекта (D12a, относительно BASE_URL) —
   * только у демо-объекта; план своего объекта — фото/скан в IndexedDB
   * (store 'plans'), не здесь. */
  planAssets?: string[];
}

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  bathroom: 'Ванная',
  kitchen: 'Кухня',
  bedroom: 'Спальня',
  living: 'Гостиная',
  hallway: 'Прихожая',
  other: 'Другое',
};

export const ROOM_TYPE_ICON: Record<RoomType, string> = {
  bathroom: '🛁',
  kitchen: '🍳',
  bedroom: '🛏️',
  living: '🛋️',
  hallway: '🚪',
  other: '📦',
};

export const FLOOR_FINISH_LABEL: Record<FloorFinish, string> = {
  tile: 'плитка',
  laminate: 'ламинат',
  vinyl: 'винил',
  none: '—',
};

export const OPENING_KIND_LABEL: Record<OpeningKind, string> = {
  door: 'дверь',
  window: 'окно',
  passage: 'проём',
};

export function floorAreaM2(r: Room): number {
  return r.lengthM * r.widthM;
}

export function projectAreaM2(p: Project): number {
  return p.rooms.reduce((s, r) => s + floorAreaM2(r), 0);
}
