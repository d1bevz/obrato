// View-типы P0 — ручное зеркало модели ввода ядра (crates/compute-core/src/model.rs).
// На P1 заменяются типами, сгенерёнными из Rust (tsify, D3/D4) — НЕ развивать
// эту копию сверх нужд экранов.

export type RoomType = 'bathroom' | 'kitchen' | 'bedroom' | 'living' | 'hallway' | 'other';

export type FloorFinish = 'tile' | 'laminate' | 'vinyl' | 'none';

export type OpeningKind = 'door' | 'window' | 'passage';

export interface Opening {
  kind: OpeningKind;
  widthM: number;
  heightM: number;
}

export interface Works {
  floor?: { finish: FloorFinish };
  walls?: { paintCoats?: number };
  ceiling?: { paintCoats?: number };
  electricPoints?: { sockets: number; switches: number; lights: number };
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  lengthM: number;
  widthM: number;
  heightM: number;
  wet: boolean;
  /** Заход гидроизоляции на стены, м (релевантно при wet). */
  wetZoneHeightM?: number;
  openings: Opening[];
  works: Works;
}

export interface Project {
  id: string;
  title: string;
  address?: string;
  status: 'planning' | 'active' | 'done';
  rooms: Room[];
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

export function floorAreaM2(r: Room): number {
  return r.lengthM * r.widthM;
}

export function projectAreaM2(p: Project): number {
  return p.rooms.reduce((s, r) => s + floorAreaM2(r), 0);
}
