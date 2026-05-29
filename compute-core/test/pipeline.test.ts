import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Project, Room } from '../src/types.ts';
import { buildPurchaseListForProject } from '../src/pipeline.ts';
import { SAMPLE_CATALOG } from '../src/catalog/sample-catalog.ts';
import { requirementsForRoom, floorAreaM2, wallAreaM2 } from '../src/norms/compute-quantities.ts';

const bathroom: Room = {
  id: 'r1',
  name: 'Ванная',
  type: 'bathroom',
  lengthM: 2.0,
  widthM: 1.7,
  heightM: 2.6,
  openings: [{ widthM: 0.7, heightM: 2.0 }], // дверь
  works: ['floor', 'walls', 'ceiling'],
  wet: true,
};

test('площадь пола = Д×Ш', () => {
  assert.equal(floorAreaM2(bathroom), 3.4);
});

test('площадь стен вычитает проём двери', () => {
  // периметр 2*(2.0+1.7)=7.4 м; ×2.6=19.24 м²; − дверь 0.7×2.0=1.4 → 17.84
  assert.equal(wallAreaM2(bathroom), 17.84);
});

test('мокрая комната → плитка + гидроизоляция', () => {
  const materials = new Set(requirementsForRoom(bathroom).map((r) => r.material));
  assert.ok(materials.has('floor-tile'), 'нет плитки пола');
  assert.ok(materials.has('wall-tile'), 'нет плитки стен');
  assert.ok(materials.has('waterproofing'), 'нет гидроизоляции');
});

test('каждое требование несёт ДОПУЩЕНИЯ (Risk #1 — для сверки с Давидом)', () => {
  for (const r of requirementsForRoom(bathroom)) {
    assert.ok(r.assumptions.notes.length > 0, `${r.material}: пустые допущения`);
  }
});

test('лист закупок сгруппирован по этапам в каноническом порядке, с тоталом', () => {
  const project: Project = { id: 'p1', title: 'Квартира Давида', rooms: [bathroom] };
  const list = buildPurchaseListForProject(project, SAMPLE_CATALOG);
  assert.ok(list.totalEur > 0, 'тотал должен быть > 0');
  assert.ok(list.byStage.length > 0, 'должны быть этапы');

  const order = ['demolition', 'rough-plumbing-electric', 'screed', 'waterproofing', 'tiling', 'wall-ceiling-finish', 'flooring', 'final'];
  const idxs = list.byStage.map((g) => order.indexOf(g.stage));
  assert.deepEqual(idxs, [...idxs].sort((a, b) => a - b), 'этапы не в каноническом порядке');
});

// TODO(Risk #1 — главный): заменить структурные проверки на КАЛИБРОВОЧНЫЕ.
// Прогнать реальный объект Давида и заассертить, что rawQuantity по каждому
// материалу сходится с его фактической закупкой в пределах его запаса.
// Сейчас нормы (norms-table.ts) — НЕвалидированные заглушки, и это ОК для скелета:
// задача первого пилота — узнать настоящие коэффициенты, а не угадать их здесь.
