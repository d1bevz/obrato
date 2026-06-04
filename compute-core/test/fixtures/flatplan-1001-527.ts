// Golden-фикстура: реальная квартира 53.7 м² из дизайн-проекта flatplan.design
// №1001_527 (docs/reference/flatplan-1001_527/). Геометрия — с обмерного плана
// (стр. 7), эталонные количества — из ведомостей проектировщика (стр. 10/11/14/15).
//
// Прямоугольные аппроксимации: кухня-гостиная/ванная/балкон — одна сторона с
// обмерного плана, вторая выведена из декларированной площади (см.
// reference.json rect_approx_note). Спальня и прихожая — обе стороны измерены.
//
// Ограничения TS-прототипа (НЕ чинить здесь — это контракт Rust-ядра, гл.05 §8):
// - нет floor_finish варианта: floor-ветка всегда считает плитку+клей+затирку,
//   даже где у проектировщика ламинат/доска → сверка по floorAreaM2, не по
//   MaterialRequirement;
// - нет кухонного фартука (w3) и зон декоративного кирпича (w4) — стены сухих
//   комнат считаются краской целиком.

import type { Project, Room } from '../../src/types.ts';

/** Декларированные проектировщиком площади помещений (экспликация, стр. 8). */
export const DECLARED_AREAS_M2: Record<string, number> = {
  'kitchen-living': 25.0,
  'bedroom': 13.0,
  'bathroom': 4.0,
  'hallway': 6.0,
  'balcony': 5.7,
};

/** Эталонные количества из ведомостей (net-площади, БЕЗ отхода). */
export const DESIGNER_QUANTITIES = {
  floorTileGroupM2: 15.7, // f1: ванная + прихожая + балкон (4.0+6.0+5.7)
  bedroomFloorM2: 13.0, // f4: инженерная доска
  kitchenFloorM2: 25.0, // f2+f3: 5.9 плитка + 19.1 ламинат
  bathroomWallTileM2: 19.7, // w1 14.35 + w2 5.35 (w3 4.3 — кухонный фартук, не ванная)
  ceilingPaintM2: 53.7, // c1 по всей квартире
  baseboardM: 34.7, // f5 (с вычетом дверей/гарнитура — прототип так не умеет, report-only)
  wallPaintM2: 96.47, // w5 (за вычетом кирпича 19.8 и плитки — report-only)
} as const;

const kitchenLiving: Room = {
  id: 'kitchen-living',
  name: 'Кухня-гостиная',
  type: 'kitchen',
  lengthM: 6.868,
  widthM: 3.64,
  heightM: 2.715,
  openings: [
    { widthM: 3.095, heightM: 1.815 }, // окно (подоконник 740)
    { widthM: 0.92, heightM: 2.095 }, // проём в прихожую (без двери)
  ],
  works: ['floor', 'walls', 'ceiling', 'electric-points'],
  wet: false,
};

const bedroom: Room = {
  id: 'bedroom',
  name: 'Спальня',
  type: 'bedroom',
  lengthM: 4.35,
  widthM: 3.005,
  heightM: 2.72,
  openings: [
    { widthM: 3.15, heightM: 1.83 }, // окно (подоконник 745)
    { widthM: 0.9, heightM: 2.06 }, // дверь d3
  ],
  works: ['floor', 'walls', 'ceiling', 'electric-points'],
  wet: false,
};

const bathroom: Room = {
  id: 'bathroom',
  name: 'Ванная',
  type: 'bathroom',
  lengthM: 2.015,
  widthM: 1.985,
  heightM: 2.68,
  openings: [
    { widthM: 0.8, heightM: 2.06 }, // дверь d4
  ],
  works: ['floor', 'walls', 'ceiling', 'electric-points'],
  wet: true,
};

const hallway: Room = {
  id: 'hallway',
  name: 'Прихожая',
  type: 'hallway',
  lengthM: 2.52,
  widthM: 2.405,
  heightM: 2.705,
  openings: [
    { widthM: 0.9, heightM: 2.06 }, // d1 входная
    { widthM: 0.9, heightM: 2.06 }, // d2
    { widthM: 0.8, heightM: 2.06 }, // d4 в ванную
    { widthM: 0.92, heightM: 2.095 }, // проём в кухню-гостиную
  ],
  works: ['floor', 'walls', 'ceiling', 'electric-points'],
  wet: false,
};

const balcony: Room = {
  id: 'balcony',
  name: 'Балкон',
  type: 'other',
  lengthM: 3.94,
  widthM: 1.445,
  heightM: 2.8,
  openings: [
    { widthM: 3.24, heightM: 2.6 }, // остекление
  ],
  works: ['floor', 'ceiling'],
  wet: false,
};

export const FLATPLAN_PROJECT: Project = {
  id: 'flatplan-1001-527',
  title: 'Квартира 53.7 м² (flatplan.design №1001_527)',
  rooms: [kitchenLiving, bedroom, bathroom, hallway, balcony],
};

/** Комнаты с плиточным полом по проекту (f1). */
export const TILE_FLOOR_ROOM_IDS = ['bathroom', 'hallway', 'balcony'] as const;
