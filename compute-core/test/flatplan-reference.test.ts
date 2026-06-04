// Golden-тест: движок против ведомостей реального проектировщика
// (flatplan.design №1001_527, docs/reference/flatplan-1001_527/).
//
// Сверяем ГЕОМЕТРИЮ (площади): ведомости проекта — это net-площади покрытий,
// прямой эталон для floorAreaM2/wallAreaM2. Расход материалов (kg/L) проект
// НЕ содержит — нормы валидируются только реальной закупкой (Risk #1, гл.11).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floorAreaM2, wallAreaM2, ceilingAreaM2 } from '../src/norms/compute-quantities.ts';
import { buildPurchaseListForProject } from '../src/pipeline.ts';
import { CATALOG } from '../src/catalog/project-seed.ts';
import {
  FLATPLAN_PROJECT,
  DECLARED_AREAS_M2,
  DESIGNER_QUANTITIES,
  TILE_FLOOR_ROOM_IDS,
} from './fixtures/flatplan-1001-527.ts';

const roomById = new Map(FLATPLAN_PROJECT.rooms.map((r) => [r.id, r]));

function pctDiff(actual: number, expected: number): number {
  return Math.abs(actual - expected) / expected;
}

test('flatplan: площадь каждой комнаты сходится с экспликацией (±3%)', () => {
  for (const [id, declared] of Object.entries(DECLARED_AREAS_M2)) {
    const room = roomById.get(id)!;
    const area = floorAreaM2(room);
    assert.ok(
      pctDiff(area, declared) <= 0.03,
      `${id}: движок ${area} м² vs экспликация ${declared} м² (>3%)`,
    );
  }
});

test('flatplan: группа плиточных полов (f1) сходится с ведомостью 15.7 м² (±3%)', () => {
  const sum = TILE_FLOOR_ROOM_IDS.reduce((s, id) => s + floorAreaM2(roomById.get(id)!), 0);
  assert.ok(
    pctDiff(sum, DESIGNER_QUANTITIES.floorTileGroupM2) <= 0.03,
    `плиточные полы: движок ${sum.toFixed(2)} м² vs ведомость ${DESIGNER_QUANTITIES.floorTileGroupM2} м²`,
  );
});

test('flatplan: суммарный потолок сходится с c1 = 53.7 м² (±3%)', () => {
  const sum = FLATPLAN_PROJECT.rooms.reduce((s, r) => s + ceilingAreaM2(r), 0);
  assert.ok(
    pctDiff(sum, DESIGNER_QUANTITIES.ceilingPaintM2) <= 0.03,
    `потолок: движок ${sum.toFixed(2)} м² vs ведомость ${DESIGNER_QUANTITIES.ceilingPaintM2} м²`,
  );
});

test('flatplan: стены ванной (net от двери) сходятся с плиткой w1+w2 = 19.7 м² (±5%)', () => {
  // Развёртки проектировщика покрывают стены ванной плиткой целиком (стр. 11).
  const walls = wallAreaM2(roomById.get('bathroom')!);
  assert.ok(
    pctDiff(walls, DESIGNER_QUANTITIES.bathroomWallTileM2) <= 0.05,
    `стены ванной: движок ${walls.toFixed(2)} м² vs плитка по ведомости ${DESIGNER_QUANTITIES.bathroomWallTileM2} м²`,
  );
});

test('flatplan: интеграция — реальный каталог даёт ненулевой лист по всей квартире', () => {
  const list = buildPurchaseListForProject(FLATPLAN_PROJECT, CATALOG);
  assert.ok(list.totalEur > 0, 'тотал листа должен быть > 0');
  assert.ok(list.byStage.length >= 3, 'ожидаем минимум 3 этапа (стяжка/плитка/отделка)');
});

test('flatplan: report-only сверки (информативно, без assert)', () => {
  // Плинтус: прототип не вычитает двери/гарнитур — фиксируем разрыв честно.
  const perimeterSum = ['kitchen-living', 'bedroom', 'hallway']
    .map((id) => roomById.get(id)!)
    .reduce((s, r) => s + 2 * (r.lengthM + r.widthM), 0);
  console.log(
    `[report] плинтус: сумма периметров (кухня+спальня+прихожая) = ${perimeterSum.toFixed(1)} м` +
      ` vs ведомость f5 = ${DESIGNER_QUANTITIES.baseboardM} м` +
      ` (проектировщик вычел двери, кухонный гарнитур и шкафы — у прототипа этого нет)`,
  );
  // Краска стен: сухие комнаты целиком как краска vs w5 96.47 (минус кирпич 19.8 и фартук 4.3).
  const dryWalls = ['kitchen-living', 'bedroom', 'hallway', 'balcony']
    .map((id) => roomById.get(id)!)
    .reduce((s, r) => s + wallAreaM2(r), 0);
  console.log(
    `[report] стены сухих комнат (net) = ${dryWalls.toFixed(1)} м²; ` +
      `проектировщик: краска 96.47 + кирпич 19.8 + фартук 4.3 = ${(96.47 + 19.8 + 4.3).toFixed(1)} м²`,
  );
  assert.ok(true);
});
