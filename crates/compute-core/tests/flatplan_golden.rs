//! Golden-приёмка M0: Rust-ядро против ведомостей реального проектировщика.
//!
//! Квартира 53.7 м² из дизайн-проекта flatplan.design №1001_527
//! (docs/reference/flatplan-1001_527/reference.json). Сверяем ГЕОМЕТРИЮ:
//! ведомости проекта — net-площади покрытий. Расход (kg/L) проект не содержит —
//! он валидируется только реальной закупкой (Risk #1, гл.11).
//!
//! Зеркало TS-теста compute-core/test/flatplan-reference.test.ts, плюс то, чего
//! TS-прототип не умел: floor_finish (плитка только где она есть у
//! проектировщика) и диапазоны/confidence на каждом числе.

use compute_core::*;

fn pct_diff(actual: f64, expected: f64) -> f64 {
    (actual - expected).abs() / expected
}

fn door(width_m: f64, height_m: f64) -> Opening {
    Opening {
        kind: OpeningKind::Door,
        width_m,
        height_m,
    }
}

fn window(width_m: f64, height_m: f64) -> Opening {
    Opening {
        kind: OpeningKind::Window,
        width_m,
        height_m,
    }
}

fn passage(width_m: f64, height_m: f64) -> Opening {
    Opening {
        kind: OpeningKind::Passage,
        width_m,
        height_m,
    }
}

fn works(floor_finish: FloorFinish) -> Works {
    Works {
        floor: Some(FloorWork {
            finish: floor_finish,
            tile_pattern: None,
        }),
        walls: Some(WallsWork {
            paint_coats: None,
            tile_pattern: None,
        }),
        ceiling: Some(CeilingWork { paint_coats: None }),
    }
}

use compute_core::model::CeilingWork;

/// Фикстура: rect-аппроксимации с обмерного плана (стр.7), документированы
/// в reference.json (rect_approx_note).
fn flatplan_project() -> Project {
    Project {
        id: "flatplan-1001-527".into(),
        title: "Квартира 53.7 м² (flatplan.design №1001_527)".into(),
        rooms: vec![
            Room {
                id: "kitchen-living".into(),
                name: "Кухня-гостиная".into(),
                room_type: RoomType::Kitchen,
                length_m: 6.868,
                width_m: 3.64,
                height_m: 2.715,
                wet: false,
                wet_zone_height_m: None,
                openings: vec![window(3.095, 1.815), passage(0.92, 2.095)],
                works: works(FloorFinish::Laminate),
            },
            Room {
                id: "bedroom".into(),
                name: "Спальня".into(),
                room_type: RoomType::Bedroom,
                length_m: 4.35,
                width_m: 3.005,
                height_m: 2.72,
                wet: false,
                wet_zone_height_m: None,
                openings: vec![window(3.15, 1.83), door(0.9, 2.06)],
                works: works(FloorFinish::Laminate), // инженерная доска — класс «не плитка»
            },
            Room {
                id: "bathroom".into(),
                name: "Ванная".into(),
                room_type: RoomType::Bathroom,
                length_m: 2.015,
                width_m: 1.985,
                height_m: 2.68,
                wet: true,
                wet_zone_height_m: Some(2.0),
                openings: vec![door(0.8, 2.06)],
                works: works(FloorFinish::Tile),
            },
            Room {
                id: "hallway".into(),
                name: "Прихожая".into(),
                room_type: RoomType::Hallway,
                length_m: 2.52,
                width_m: 2.405,
                height_m: 2.705,
                wet: false,
                wet_zone_height_m: None,
                openings: vec![
                    door(0.9, 2.06),
                    door(0.9, 2.06),
                    door(0.8, 2.06),
                    passage(0.92, 2.095),
                ],
                works: works(FloorFinish::Tile),
            },
            Room {
                id: "balcony".into(),
                name: "Балкон".into(),
                room_type: RoomType::Other,
                length_m: 3.94,
                width_m: 1.445,
                height_m: 2.8,
                wet: false,
                wet_zone_height_m: None,
                openings: vec![window(3.24, 2.6)],
                works: Works {
                    floor: Some(FloorWork {
                        finish: FloorFinish::Tile,
                        tile_pattern: None,
                    }),
                    walls: None,
                    ceiling: Some(CeilingWork { paint_coats: None }),
                },
            },
        ],
    }
}

/// Экспликация (стр.8): декларированные площади.
const DECLARED: &[(&str, f64)] = &[
    ("kitchen-living", 25.0),
    ("bedroom", 13.0),
    ("bathroom", 4.0),
    ("hallway", 6.0),
    ("balcony", 5.7),
];

#[test]
// Честная оговорка: для kitchen/bathroom/balcony одна сторона фикстуры
// выведена из декларированной площади (rect_approx_note в reference.json) —
// для них assert близок к тавтологии. Независимая сверка — bedroom (13.07
// vs 13.0) и hallway (6.06 vs 6.0), где обе стороны сняты с обмерного плана.
fn room_areas_match_explication_within_3pct() {
    let project = flatplan_project();
    for (id, declared) in DECLARED {
        let room = project.rooms.iter().find(|r| r.id == *id).unwrap();
        let area = geometry::floor_area_m2(room);
        assert!(
            pct_diff(area, *declared) <= 0.03,
            "{id}: движок {area:.2} м² vs экспликация {declared} м²"
        );
    }
}

#[test]
fn floor_tile_estimates_cover_designer_f1_group() {
    // f1 = ванная + прихожая + балкон = 15.7 м² (ведомость, стр.10).
    // С floor_finish плитка пола считается ТОЛЬКО в этих комнатах —
    // TS-прототип плитил все полы, Rust-ядро не должно.
    let estimates = estimates_for_project(&flatplan_project());
    let tile: Vec<_> = estimates
        .iter()
        .filter(|e| e.material == MaterialKind::FloorTile)
        .collect();
    let rooms: Vec<&str> = tile.iter().map(|e| e.room_id.as_str()).collect();
    assert_eq!(
        tile.len(),
        3,
        "плитка пола только в 3 комнатах, есть в: {rooms:?}"
    );
    for expected in ["bathroom", "hallway", "balcony"] {
        assert!(rooms.contains(&expected), "нет плитки пола в {expected}");
    }
    let driving_sum: f64 = tile.iter().map(|e| e.driving_measure_value).sum();
    assert!(
        pct_diff(driving_sum, 15.7) <= 0.03,
        "плиточные полы: движок {driving_sum:.2} м² vs ведомость 15.7 м²"
    );
}

#[test]
fn laminate_rooms_get_no_floor_tile_but_get_leveler_and_baseboard() {
    let estimates = estimates_for_project(&flatplan_project());
    for room_id in ["kitchen-living", "bedroom"] {
        let mats: Vec<MaterialKind> = estimates
            .iter()
            .filter(|e| e.room_id == room_id)
            .map(|e| e.material)
            .collect();
        assert!(
            !mats.contains(&MaterialKind::FloorTile),
            "{room_id}: плитки быть не должно"
        );
        assert!(
            !mats.contains(&MaterialKind::Grout),
            "{room_id}: затирки быть не должно"
        );
        assert!(
            mats.contains(&MaterialKind::FloorLeveler),
            "{room_id}: ровнитель нужен"
        );
        assert!(
            mats.contains(&MaterialKind::Baseboard),
            "{room_id}: плинтус нужен"
        );
    }
}

#[test]
// c1 = 53.7 — сумма экспликации (не независимая ведомость); тест ловит
// регрессии суммирования/ветвления потолков, не геометрию per se.
fn ceiling_paint_driving_sum_matches_c1_53_7() {
    let estimates = estimates_for_project(&flatplan_project());
    let ceiling_paint: f64 = estimates
        .iter()
        .filter(|e| {
            e.material == MaterialKind::Paint && e.driving_measure == DrivingMeasure::CeilingAreaM2
        })
        .map(|e| e.driving_measure_value)
        .sum();
    assert!(
        pct_diff(ceiling_paint, 53.7) <= 0.03,
        "потолок: движок {ceiling_paint:.2} м² vs ведомость c1 = 53.7 м²"
    );
}

#[test]
fn bathroom_wall_tile_matches_w1_w2_19_7() {
    // Развёртки (стр.11): w1 14.35 + w2 5.35 = 19.7 м² плитки стен ванной.
    let estimates = estimates_for_project(&flatplan_project());
    let wall_tile = estimates
        .iter()
        .find(|e| e.material == MaterialKind::WallTile && e.room_id == "bathroom")
        .expect("в ванной должна быть настенная плитка");
    assert!(
        pct_diff(wall_tile.driving_measure_value, 19.7) <= 0.05,
        "стены ванной: движок {:.2} м² vs ведомость w1+w2 = 19.7 м²",
        wall_tile.driving_measure_value
    );
}

#[test]
fn waterproofing_area_exceeds_floor_by_upstand() {
    // Дыра, закрытая 2026-06-04: площадь гидры = пол + периметр × заход.
    let estimates = estimates_for_project(&flatplan_project());
    let wp = estimates
        .iter()
        .find(|e| e.material == MaterialKind::Waterproofing)
        .expect("в мокрой ванной должна быть гидроизоляция");
    assert_eq!(wp.driving_measure, DrivingMeasure::WaterproofingAreaM2);
    // пол 4.0 + периметр 8.0 × заход 2.0 = 20.0 м²
    assert!(
        pct_diff(wp.driving_measure_value, 20.0) <= 0.03,
        "гидроизоляция: движок {:.2} м², ожидалось ~20.0 (пол + заход)",
        wp.driving_measure_value
    );
    assert_eq!(
        wp.applied_assumptions.upstand_height_mm,
        Some(2000.0),
        "применённый заход должен ехать в assumptions (reconciliation)"
    );
}

#[test]
fn every_estimate_is_a_range_with_confidence_and_pin() {
    // D7: ни одной точечной «голой» оценки без диапазона и допущений.
    let estimates = estimates_for_project(&flatplan_project());
    assert!(!estimates.is_empty());
    for e in &estimates {
        assert!(
            e.quantity.lo <= e.quantity.central && e.quantity.central <= e.quantity.hi,
            "{}/{}: lo ≤ central ≤ hi нарушено: {:?}",
            e.room_id,
            e.material.key(),
            e.quantity
        );
        assert!(
            e.quantity.central > 0.0,
            "{}: нулевая оценка",
            e.material.key()
        );
        assert_eq!(
            e.norm_set_label, "global-seed-v1-ch07",
            "пин NormSet обязателен (D6)"
        );
    }
    // Seed-нормы без замеров обязаны быть честно Unvalidated хотя бы где-то
    // (клей без зуба, ровнитель без толщины) — Risk #1 как фича.
    assert!(
        estimates
            .iter()
            .any(|e| e.quantity.confidence == Confidence::Unvalidated),
        "ожидались Unvalidated-оценки на seed-нормах"
    );
}

#[test]
fn stages_are_in_canonical_order() {
    let estimates = estimates_for_project(&flatplan_project());
    let stages: Vec<Stage> = estimates.iter().map(|e| e.stage).collect();
    let mut sorted = stages.clone();
    sorted.sort();
    assert_eq!(stages, sorted, "этапы не в каноническом порядке гл.05 §5");
}

#[test]
fn baseboard_matches_designer_f5_34_7() {
    // Плинтус — ось laminate/vinyl (гл.08 §3.3): кухня (ламинат) + спальня
    // (доска). Движок: периметры − двери/проёмы = 20.10 + 13.81 = 33.91 м
    // vs ведомость f5 = 34.7 мп — независимая сверка против проектировщика
    // (он вычитал двери так же; разница 2.3% — гарнитур/шкафы и округления).
    let estimates = estimates_for_project(&flatplan_project());
    let baseboard: Vec<_> = estimates
        .iter()
        .filter(|e| e.material == MaterialKind::Baseboard)
        .collect();
    let rooms: Vec<&str> = baseboard.iter().map(|e| e.room_id.as_str()).collect();
    assert_eq!(
        baseboard.len(),
        2,
        "плинтус только в ламинатных комнатах (гл.08 §3.3), есть в: {rooms:?}"
    );
    for e in &baseboard {
        assert_eq!(
            e.stage,
            Stage::Flooring,
            "плинтус — этап flooring (гл.08 §3.3)"
        );
    }
    let sum: f64 = baseboard.iter().map(|e| e.driving_measure_value).sum();
    assert!(
        pct_diff(sum, 34.7) <= 0.05,
        "плинтус: движок {sum:.2} м vs ведомость f5 = 34.7 м"
    );
}

#[test]
fn report_only_comparisons() {
    // Информативные сверки без assert (как в TS-зеркале).
    let project = flatplan_project();
    // Стены, которые движок реально красит (dry + walls заданы): кухня,
    // спальня, прихожая — балкон walls: None и в счёт не входит.
    let painted_walls: f64 = project
        .rooms
        .iter()
        .filter(|r| !r.wet && r.works.walls.is_some())
        .map(geometry::wall_area_m2)
        .sum();
    println!(
        "[report] крашеные стены движка = {painted_walls:.1} м² vs проектировщик: краска 96.47 м² \
         (включает балкон ~21.7 и за вычетом кирпича 19.8 / фартука 4.3 — зоны вне модели ядра)"
    );
}
