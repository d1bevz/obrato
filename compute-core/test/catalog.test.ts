import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MaterialKind, Project, Room, Unit } from '../src/types.ts';
import { SEED, CATALOG, projectCatalog, currentPriceFor } from '../src/catalog/project-seed.ts';
import { buildPurchaseListForProject } from '../src/pipeline.ts';

// 9 видов материала пилота = MaterialKind = ключи NormRule (гл.05 §4 / гл.07).
const MATERIAL_KEYS: MaterialKind[] = [
  'floor-tile',
  'wall-tile',
  'tile-adhesive',
  'grout',
  'paint',
  'primer',
  'screed-mix',
  'waterproofing',
  'baseboard',
];

const UNITS: Unit[] = ['m2', 'kg', 'l', 'm', 'pcs'];

test('seed несёт catalog_version', () => {
  assert.ok(SEED.catalog_version && SEED.catalog_version.length > 0, 'нет catalog_version');
});

test('id уникальны внутри каждой сущности', () => {
  for (const [label, rows] of [
    ['stores', SEED.stores],
    ['materials', SEED.materials],
    ['skus', SEED.skus],
    ['prices', SEED.prices],
  ] as const) {
    const ids = rows.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, `дубли id в ${label}`);
  }
});

test('ровно 9 материалов пилота, все active, у каждого default_sku_id', () => {
  const keys = SEED.materials.map((m) => m.key).sort();
  assert.deepEqual(keys, [...MATERIAL_KEYS].sort(), 'набор материалов != 9 видов пилота');
  for (const m of SEED.materials) {
    assert.ok(m.active, `${m.key}: неактивен`);
    assert.ok(m.default_sku_id, `${m.key}: нет default_sku_id`);
    assert.ok(UNITS.includes(m.base_unit), `${m.key}: невалидный base_unit ${m.base_unit}`);
  }
});

test('ссылочная целостность: sku.material_id / sku.store_id / price.sku_id резолвятся', () => {
  const matIds = new Set(SEED.materials.map((m) => m.id));
  const storeIds = new Set(SEED.stores.map((s) => s.id));
  const skuIds = new Set(SEED.skus.map((s) => s.id));
  for (const s of SEED.skus) {
    assert.ok(matIds.has(s.material_id), `sku ${s.id}: material_id ${s.material_id} не найден`);
    assert.ok(storeIds.has(s.store_id), `sku ${s.id}: store_id ${s.store_id} не найден`);
  }
  for (const p of SEED.prices) {
    assert.ok(skuIds.has(p.sku_id), `price ${p.id}: sku_id ${p.sku_id} не найден`);
  }
});

test('default_sku_id резолвится в SKU того же материала', () => {
  const skuById = new Map(SEED.skus.map((s) => [s.id, s]));
  for (const m of SEED.materials) {
    const sku = skuById.get(m.default_sku_id!);
    assert.ok(sku, `${m.key}: default_sku_id ${m.default_sku_id} нет в skus`);
    assert.equal(sku!.material_id, m.id, `${m.key}: default_sku принадлежит другому материалу`);
  }
});

test('ИНВАРИАНТ ПИЛОТА: pack_unit == base_unit материала (или есть coverage_per_pack)', () => {
  const matById = new Map(SEED.materials.map((m) => [m.id, m]));
  for (const s of SEED.skus) {
    const m = matById.get(s.material_id)!;
    if (s.pack_unit !== m.base_unit) {
      assert.ok(
        s.coverage_per_pack,
        `sku ${s.id}: pack_unit ${s.pack_unit} != base_unit ${m.base_unit} (${m.key}) без coverage_per_pack`,
      );
    }
    assert.ok(s.pack_size > 0, `sku ${s.id}: pack_size должен быть > 0`);
    assert.ok(UNITS.includes(s.pack_unit), `sku ${s.id}: невалидный pack_unit ${s.pack_unit}`);
  }
});

test('каждый SKU имеет минимум одну цену', () => {
  for (const s of SEED.skus) {
    assert.ok(currentPriceFor(SEED, s.id), `sku ${s.id}: нет ни одной цены`);
  }
});

test('D10: цены — integer money, sourced, помечены ориентиром', () => {
  for (const p of SEED.prices) {
    assert.ok(Number.isInteger(p.amount_minor_units), `price ${p.id}: amount_minor_units не integer`);
    assert.ok(p.amount_minor_units > 0, `price ${p.id}: amount_minor_units должен быть > 0`);
    assert.equal(p.currency, 'EUR', `price ${p.id}: валюта не EUR`);
    assert.ok(p.captured_at && p.captured_at.length > 0, `price ${p.id}: нет captured_at`);
    assert.ok(p.source && p.source.length > 0, `price ${p.id}: нет source`);
    assert.equal(p.is_estimate, true, `price ${p.id}: seed-цена должна быть is_estimate=true (D10)`);
  }
});

test('каталог курируемого размера: 50..100 SKU', () => {
  assert.ok(SEED.skus.length >= 50 && SEED.skus.length <= 100, `SKU = ${SEED.skus.length}, ожидалось 50..100`);
});

test('multi-store: оба магазина (leroy-pt + local), у каждого есть SKU', () => {
  const keys = SEED.stores.map((s) => s.key).sort();
  assert.deepEqual(keys, ['leroy-pt', 'local'], `магазины != leroy-pt + local: ${keys}`);
  const storeById = new Map(SEED.stores.map((s) => [s.id, s.key]));
  const perStore = new Map<string, number>();
  for (const s of SEED.skus) {
    const k = storeById.get(s.store_id)!;
    perStore.set(k, (perStore.get(k) ?? 0) + 1);
  }
  assert.ok((perStore.get('leroy-pt') ?? 0) > 0, 'нет SKU в leroy-pt');
  assert.ok((perStore.get('local') ?? 0) > 0, 'нет SKU в local');
});

test('проекция покрывает все 9 видов материала, валидными SKU движка', () => {
  const cat = projectCatalog(SEED);
  for (const key of MATERIAL_KEYS) {
    const sku = cat[key];
    assert.ok(sku, `проекция: нет SKU для ${key}`);
    assert.equal(sku.material, key, `проекция: material != ${key}`);
    assert.ok(sku.packSize > 0, `проекция ${key}: packSize должен быть > 0`);
    assert.ok(sku.priceEur > 0, `проекция ${key}: priceEur должен быть > 0`);
    assert.ok(['leroy-pt', 'local'].includes(sku.store), `проекция ${key}: невалидный store ${sku.store}`);
  }
  assert.deepEqual(CATALOG, cat, 'экспортированный CATALOG != projectCatalog(SEED)');
});

test('интеграция: реальный каталог даёт ненулевой лист закупок', () => {
  const bathroom: Room = {
    id: 'r1',
    name: 'Ванная',
    type: 'bathroom',
    lengthM: 2.0,
    widthM: 1.7,
    heightM: 2.6,
    openings: [{ widthM: 0.7, heightM: 2.0 }],
    works: ['floor', 'walls', 'ceiling'],
    wet: true,
  };
  const project: Project = { id: 'p1', title: 'Квартира Давида', rooms: [bathroom] };
  const list = buildPurchaseListForProject(project, CATALOG);
  assert.ok(list.totalEur > 0, 'тотал должен быть > 0');
  assert.ok(list.byStage.length > 0, 'должны быть этапы');
});
