// RoomTemplate.default_works/default_wet (гл.08 §3.4): предзаполнение по
// типу комнаты — прораб правит дельту, а не заполняет анкету (П3, Open Q4).
// Числа — стартовые дефолты шаблона; калибруются практикой Давида.

import type { RoomType } from 'compute-wasm';
import type { ElectricPoints, Works } from '../types';

export interface RoomTemplate {
  /** Дефолт мокрой зоны (прораб перекрывает одним тапом — гл.08 §3.2). */
  wet: boolean;
  /** Заход гидроизоляции по умолчанию при wet, м (гл.05 §2). */
  wetZoneHeightM: number;
  works: Works;
  defaultName: string;
}

const PAINT2 = { paintCoats: 2 };

function electric(sockets: number, switches: number, lights: number): ElectricPoints {
  return { sockets, switches, lights };
}

export const ROOM_TEMPLATES: Record<RoomType, RoomTemplate> = {
  bathroom: {
    wet: true,
    wetZoneHeightM: 2.0,
    defaultName: 'Ванная',
    works: {
      floor: { finish: 'tile' },
      walls: {}, // мокрая ветка: плитку решает ядро по wet (гл.08 §3.2)
      ceiling: PAINT2,
      electricPoints: electric(2, 1, 2),
    },
  },
  kitchen: {
    wet: false,
    wetZoneHeightM: 2.0,
    defaultName: 'Кухня',
    works: {
      floor: { finish: 'tile' },
      walls: PAINT2,
      ceiling: PAINT2,
      electricPoints: electric(6, 2, 3),
    },
  },
  bedroom: {
    wet: false,
    wetZoneHeightM: 2.0,
    defaultName: 'Спальня',
    works: {
      floor: { finish: 'laminate' },
      walls: PAINT2,
      ceiling: PAINT2,
      electricPoints: electric(4, 2, 1),
    },
  },
  living: {
    wet: false,
    wetZoneHeightM: 2.0,
    defaultName: 'Гостиная',
    works: {
      floor: { finish: 'laminate' },
      walls: PAINT2,
      ceiling: PAINT2,
      electricPoints: electric(6, 3, 2),
    },
  },
  hallway: {
    wet: false,
    wetZoneHeightM: 2.0,
    defaultName: 'Прихожая',
    works: {
      floor: { finish: 'tile' },
      walls: PAINT2,
      ceiling: PAINT2,
      electricPoints: electric(1, 3, 1),
    },
  },
  other: {
    wet: false,
    wetZoneHeightM: 2.0,
    defaultName: 'Помещение',
    works: {
      floor: { finish: 'none' },
      walls: PAINT2,
      ceiling: PAINT2,
      electricPoints: electric(2, 1, 1),
    },
  },
};

/** Дефолтные размеры нового проёма по виду (гл.08 §3: типовые ПТ-габариты). */
export const OPENING_DEFAULTS = {
  door: { widthM: 0.9, heightM: 2.06 },
  window: { widthM: 1.2, heightM: 1.4 },
  passage: { widthM: 0.92, heightM: 2.1 },
} as const;
