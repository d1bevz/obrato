// Демо-проект: реальная квартира 53.7 м² из дизайн-проекта flatplan.design
// №1001_527 (docs/reference/flatplan-1001_527/reference.json). Та же фикстура,
// что в golden-тестах ядра (crates/compute-core/tests/flatplan_golden.rs).

import type { Project } from '../types';

export const FLATPLAN_DEMO: Project = {
  id: 'flatplan-1001-527',
  title: 'Квартира 53.7 м² (демо)',
  address: 'flatplan.design · проект №1001_527',
  status: 'planning',
  // Реальные страницы дизайн-проекта (D12a): планировка + обмерный план,
  // отрендерены из docs/reference/flatplan-1001_527.pdf (стр. 8 и 7).
  planAssets: [
    'plans/flatplan-1001_527-p8-layout.png',
    'plans/flatplan-1001_527-p7-measure.png',
  ],
  rooms: [
    {
      id: 'kitchen-living',
      name: 'Кухня-гостиная',
      type: 'kitchen',
      lengthM: 6.868,
      widthM: 3.64,
      heightM: 2.715,
      wet: false,
      openings: [
        { kind: 'window', widthM: 3.095, heightM: 1.815 },
        { kind: 'passage', widthM: 0.92, heightM: 2.095 },
      ],
      works: {
        floor: { finish: 'laminate' },
        walls: { paintCoats: 2 },
        ceiling: { paintCoats: 2 },
        electricPoints: { sockets: 6, switches: 2, lights: 3 },
      },
    },
    {
      id: 'bedroom',
      name: 'Спальня',
      type: 'bedroom',
      lengthM: 4.35,
      widthM: 3.005,
      heightM: 2.72,
      wet: false,
      openings: [
        { kind: 'window', widthM: 3.15, heightM: 1.83 },
        { kind: 'door', widthM: 0.9, heightM: 2.06 },
      ],
      works: {
        floor: { finish: 'laminate' },
        walls: { paintCoats: 2 },
        ceiling: { paintCoats: 2 },
        electricPoints: { sockets: 4, switches: 2, lights: 1 },
      },
    },
    {
      id: 'bathroom',
      name: 'Ванная',
      type: 'bathroom',
      lengthM: 2.015,
      widthM: 1.985,
      heightM: 2.68,
      wet: true,
      wetZoneHeightM: 2.0,
      openings: [{ kind: 'door', widthM: 0.8, heightM: 2.06 }],
      works: {
        floor: { finish: 'tile' },
        walls: {},
        ceiling: { paintCoats: 2 },
        electricPoints: { sockets: 1, switches: 1, lights: 2 },
      },
    },
    {
      id: 'hallway',
      name: 'Прихожая',
      type: 'hallway',
      lengthM: 2.52,
      widthM: 2.405,
      heightM: 2.705,
      wet: false,
      openings: [
        { kind: 'door', widthM: 0.9, heightM: 2.06 },
        { kind: 'door', widthM: 0.9, heightM: 2.06 },
        { kind: 'door', widthM: 0.8, heightM: 2.06 },
        { kind: 'passage', widthM: 0.92, heightM: 2.095 },
      ],
      works: {
        floor: { finish: 'tile' },
        walls: { paintCoats: 2 },
        ceiling: { paintCoats: 2 },
        electricPoints: { sockets: 1, switches: 2, lights: 2 },
      },
    },
    {
      id: 'balcony',
      name: 'Балкон',
      type: 'other',
      lengthM: 3.94,
      widthM: 1.445,
      heightM: 2.8,
      wet: false,
      openings: [{ kind: 'window', widthM: 3.24, heightM: 2.6 }],
      works: {
        floor: { finish: 'tile' },
        ceiling: { paintCoats: 2 },
      },
    },
  ],
};
