//! Приёмка P3: packaging в ядре — упаковки (ceil, «бери до»), integer money,
//! unit-инвариант, группировка по этапам. Каталог-фикстура — default-SKU
//! значения из seed.json (compute-core/src/catalog/seed.json, v2026.05.30).

use compute_core::*;

fn room_bathroom() -> Room {
    Room {
        id: "bathroom".into(),
        name: "Ванная".into(),
        room_type: RoomType::Bathroom,
        length_m: 2.0,
        width_m: 2.0,
        height_m: 2.7,
        wet: true,
        wet_zone_height_m: Some(2.0),
        openings: vec![Opening {
            kind: OpeningKind::Door,
            width_m: 0.8,
            height_m: 2.06,
        }],
        works: Works {
            floor: Some(FloorWork {
                finish: FloorFinish::Tile,
                tile_pattern: None,
            }),
            walls: Some(WallsWork {
                paint_coats: None,
                tile_pattern: None,
            }),
            ceiling: Some(model::CeilingWork {
                paint_coats: Some(2),
            }),
        },
    }
}

fn project() -> Project {
    Project {
        id: "p1".into(),
        title: "тест".into(),
        rooms: vec![room_bathroom()],
    }
}

fn sku(material: MaterialKind, id: &str, pack: f64, unit: Unit, price: i64) -> SkuView {
    SkuView {
        material,
        sku_id: id.into(),
        pack_size: pack,
        pack_unit: unit,
        coverage_per_pack: None,
        price_minor_units: Some(price),
    }
}

fn catalog() -> Vec<SkuView> {
    vec![
        sku(MaterialKind::FloorTile, "sku-ft", 1.42, Unit::M2, 2270),
        sku(MaterialKind::WallTile, "sku-wt", 1.13, Unit::M2, 3163),
        sku(MaterialKind::TileAdhesive, "sku-ta", 25.0, Unit::Kg, 1479),
        sku(MaterialKind::Grout, "sku-gr", 5.0, Unit::Kg, 1450),
        sku(MaterialKind::Paint, "sku-pa", 15.0, Unit::L, 4990),
        sku(MaterialKind::Primer, "sku-pr", 5.0, Unit::L, 3499),
        sku(MaterialKind::FloorLeveler, "sku-fl", 25.0, Unit::Kg, 1900),
        sku(MaterialKind::Waterproofing, "sku-wp", 20.0, Unit::Kg, 6900),
    ]
}

#[test]
fn packs_needed_ceils_up_and_handles_zero() {
    assert_eq!(packs_needed(0.0, 5.0), 0);
    assert_eq!(packs_needed(-1.0, 5.0), 0);
    assert_eq!(packs_needed(0.1, 5.0), 1);
    assert_eq!(packs_needed(5.0, 5.0), 1);
    assert_eq!(packs_needed(5.0001, 5.0), 2);
    assert_eq!(packs_needed(14.2, 1.42), 10);
}

#[test]
fn list_groups_by_stage_in_canonical_order_with_items() {
    let estimates = estimates_for_project(&project());
    let (list, rejections) = purchase_list(&estimates, &catalog(), "test-v1");
    assert!(rejections.is_empty(), "{rejections:?}");

    let stages: Vec<Stage> = list.by_stage.iter().map(|g| g.stage).collect();
    let mut sorted = stages.clone();
    sorted.sort();
    assert_eq!(stages, sorted, "этапы в каноническом порядке");
    // Мокрая плиточная ванная: стяжка, гидра, плитка, отделка.
    assert!(stages.contains(&Stage::Screed));
    assert!(stages.contains(&Stage::Waterproofing));
    assert!(stages.contains(&Stage::Tiling));
    assert!(stages.contains(&Stage::WallCeilingFinish));
}

#[test]
fn packs_high_is_buy_up_to_and_money_is_integer() {
    let estimates = estimates_for_project(&project());
    let (list, _) = purchase_list(&estimates, &catalog(), "test-v1");

    for g in &list.by_stage {
        let mut subtotal_check = (0i64, 0i64, 0i64);
        for item in &g.items {
            let p = item.packs.expect("каталог полон — packs есть");
            assert!(p.low <= p.expected && p.expected <= p.high, "packs упорядочены");
            let q = item.quantity;
            let pack = item.pack_size.unwrap();
            // ceil-инвариант: packs покрывает количество.
            assert!(f64::from(p.expected) * pack >= q.expected - 1e-9);
            assert!(f64::from(p.high) * pack >= q.high - 1e-9);

            let lt = item.line_total.expect("цены заданы");
            assert!(lt.is_estimate, "деньги пилота всегда «ориентир» (D10)");
            // Integer money: line_total = packs × price, без дробей.
            subtotal_check.0 += lt.low_minor_units;
            subtotal_check.1 += lt.expected_minor_units;
            subtotal_check.2 += lt.high_minor_units;
        }
        assert_eq!(g.subtotal.low_minor_units, subtotal_check.0);
        assert_eq!(g.subtotal.expected_minor_units, subtotal_check.1);
        assert_eq!(g.subtotal.high_minor_units, subtotal_check.2);
    }

    let mut total = (0i64, 0i64, 0i64);
    for g in &list.by_stage {
        total.0 += g.subtotal.low_minor_units;
        total.1 += g.subtotal.expected_minor_units;
        total.2 += g.subtotal.high_minor_units;
    }
    assert_eq!(list.total.expected_minor_units, total.1);
    assert!(list.total.expected_minor_units > 0);
    assert_eq!(list.norm_set_label, "global-seed-v1-ch07");
    assert_eq!(list.catalog_version, "test-v1");
}

#[test]
fn unit_invariant_rejects_mismatched_pack_unit_without_coverage() {
    let estimates = estimates_for_project(&project());
    let mut cat = catalog();
    // Краска фасуется «шт» без coverage — нарушение unit-инварианта.
    cat.iter_mut()
        .find(|s| s.material == MaterialKind::Paint)
        .unwrap()
        .pack_unit = Unit::Pcs;

    let (list, rejections) = purchase_list(&estimates, &cat, "test-v1");
    assert_eq!(rejections.len(), 1);
    assert_eq!(rejections[0].material, MaterialKind::Paint);

    // Строка краски осталась в листе — количество без packs/денег.
    let paint = list
        .by_stage
        .iter()
        .flat_map(|g| &g.items)
        .find(|i| i.material == MaterialKind::Paint)
        .expect("позиция не выпала из листа");
    assert!(paint.packs.is_none());
    assert!(paint.line_total.is_none());
    assert!(paint.quantity.expected > 0.0);
}

#[test]
fn coverage_per_pack_resolves_pcs_packaging() {
    let estimates = estimates_for_project(&project());
    let mut cat = catalog();
    {
        let paint = cat
            .iter_mut()
            .find(|s| s.material == MaterialKind::Paint)
            .unwrap();
        paint.pack_unit = Unit::Pcs;
        paint.pack_size = 1.0;
        paint.coverage_per_pack = Some(15.0); // банка покрывает 15 л-эквивалента
    }
    let (list, rejections) = purchase_list(&estimates, &cat, "test-v1");
    assert!(rejections.is_empty());
    let paint = list
        .by_stage
        .iter()
        .flat_map(|g| &g.items)
        .find(|i| i.material == MaterialKind::Paint)
        .unwrap();
    assert_eq!(paint.pack_size, Some(15.0));
    assert!(paint.packs.is_some());
}

#[test]
fn material_without_sku_view_keeps_quantity_row() {
    let estimates = estimates_for_project(&project());
    let cat: Vec<SkuView> = catalog()
        .into_iter()
        .filter(|s| s.material != MaterialKind::Grout)
        .collect();
    let (list, rejections) = purchase_list(&estimates, &cat, "test-v1");
    assert!(rejections.is_empty(), "отсутствие SkuView — не rejection");
    let grout = list
        .by_stage
        .iter()
        .flat_map(|g| &g.items)
        .find(|i| i.material == MaterialKind::Grout)
        .expect("затирка в листе");
    assert!(grout.sku_id.is_none());
    assert!(grout.packs.is_none());
    assert!(grout.line_total.is_none());
}

#[test]
fn unsorted_estimates_still_yield_one_group_per_stage_in_canonical_order() {
    let mut estimates = estimates_for_project(&project());
    estimates.reverse(); // ломаем сортировку движка
    let (list, _) = purchase_list(&estimates, &catalog(), "test-v1");
    let stages: Vec<Stage> = list.by_stage.iter().map(|g| g.stage).collect();
    let mut dedup = stages.clone();
    dedup.dedup();
    assert_eq!(stages, dedup, "дубль-группы одного этапа: {stages:?}");
    let mut sorted = stages.clone();
    sorted.sort();
    assert_eq!(stages, sorted, "этапы не в каноническом порядке");
}

#[test]
fn item_freezes_price_per_pack_by_value() {
    // frozen_list самодостаточен (гл.05 §5): цена-за-упаковку едет в item.
    let estimates = estimates_for_project(&project());
    let (list, _) = purchase_list(&estimates, &catalog(), "test-v1");
    for item in list.by_stage.iter().flat_map(|g| &g.items) {
        assert!(
            item.price_minor_units.is_some(),
            "{:?}: цена за упаковку должна замораживаться by value",
            item.material
        );
    }
}

#[test]
fn qty_confidence_reflects_range_width() {
    let estimates = estimates_for_project(&project());
    let (list, _) = purchase_list(&estimates, &catalog(), "test-v1");
    let items: Vec<&PurchaseItem> = list.by_stage.iter().flat_map(|g| &g.items).collect();

    // Плитка: waste-полоса узкая (straight 8–12%) → не wide.
    let tile = items
        .iter()
        .find(|i| i.material == MaterialKind::FloorTile)
        .unwrap();
    assert_ne!(tile.quantity.confidence, QtyConfidence::Wide);

    // Клей: seed-диапазон без зуба гладилки → честно wide.
    let adhesive = items
        .iter()
        .find(|i| i.material == MaterialKind::TileAdhesive)
        .unwrap();
    assert_eq!(adhesive.quantity.confidence, QtyConfidence::Wide);
}
