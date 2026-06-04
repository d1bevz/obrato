//! Parity-приёмка P1: JSON с TS-стороны (форма apps/pwa/src/demo/flatplan.ts,
//! camelCase + лишние поля address/status/electricPoints) → DTO → ядро даёт
//! ровно те же оценки, что прямой вызов ядра на golden-фикстуре
//! (crates/compute-core/tests/flatplan_golden.rs).
//!
//! Конверсия DTO ↔ core — чистый Rust: тестируется нативно, без браузера
//! (dev-loop гл.09 §5: `.wasm` пересобирается только при смене контракта).

use compute_core as core;
use compute_wasm::dto;

/// Демо-квартира в ТОЧНОЙ форме PWA-фикстуры (apps/pwa/src/demo/flatplan.ts):
/// camelCase, `type`, лишние ключи — их serde обязан игнорировать.
const FLATPLAN_JSON: &str = r#"{
  "id": "flatplan-1001-527",
  "title": "Квартира 53.7 м² (демо)",
  "address": "flatplan.design · проект №1001_527",
  "status": "planning",
  "rooms": [
    {
      "id": "kitchen-living",
      "name": "Кухня-гостиная",
      "type": "kitchen",
      "lengthM": 6.868,
      "widthM": 3.64,
      "heightM": 2.715,
      "wet": false,
      "openings": [
        { "kind": "window", "widthM": 3.095, "heightM": 1.815 },
        { "kind": "passage", "widthM": 0.92, "heightM": 2.095 }
      ],
      "works": {
        "floor": { "finish": "laminate" },
        "walls": { "paintCoats": 2 },
        "ceiling": { "paintCoats": 2 },
        "electricPoints": { "sockets": 6, "switches": 2, "lights": 3 }
      }
    },
    {
      "id": "bedroom",
      "name": "Спальня",
      "type": "bedroom",
      "lengthM": 4.35,
      "widthM": 3.005,
      "heightM": 2.72,
      "wet": false,
      "openings": [
        { "kind": "window", "widthM": 3.15, "heightM": 1.83 },
        { "kind": "door", "widthM": 0.9, "heightM": 2.06 }
      ],
      "works": {
        "floor": { "finish": "laminate" },
        "walls": { "paintCoats": 2 },
        "ceiling": { "paintCoats": 2 },
        "electricPoints": { "sockets": 4, "switches": 2, "lights": 1 }
      }
    },
    {
      "id": "bathroom",
      "name": "Ванная",
      "type": "bathroom",
      "lengthM": 2.015,
      "widthM": 1.985,
      "heightM": 2.68,
      "wet": true,
      "wetZoneHeightM": 2.0,
      "openings": [{ "kind": "door", "widthM": 0.8, "heightM": 2.06 }],
      "works": {
        "floor": { "finish": "tile" },
        "walls": {},
        "ceiling": { "paintCoats": 2 },
        "electricPoints": { "sockets": 1, "switches": 1, "lights": 2 }
      }
    },
    {
      "id": "hallway",
      "name": "Прихожая",
      "type": "hallway",
      "lengthM": 2.52,
      "widthM": 2.405,
      "heightM": 2.705,
      "wet": false,
      "openings": [
        { "kind": "door", "widthM": 0.9, "heightM": 2.06 },
        { "kind": "door", "widthM": 0.9, "heightM": 2.06 },
        { "kind": "door", "widthM": 0.8, "heightM": 2.06 },
        { "kind": "passage", "widthM": 0.92, "heightM": 2.095 }
      ],
      "works": {
        "floor": { "finish": "tile" },
        "walls": { "paintCoats": 2 },
        "ceiling": { "paintCoats": 2 },
        "electricPoints": { "sockets": 1, "switches": 2, "lights": 2 }
      }
    },
    {
      "id": "balcony",
      "name": "Балкон",
      "type": "other",
      "lengthM": 3.94,
      "widthM": 1.445,
      "heightM": 2.8,
      "wet": false,
      "openings": [{ "kind": "window", "widthM": 3.24, "heightM": 2.6 }],
      "works": {
        "floor": { "finish": "tile" },
        "ceiling": { "paintCoats": 2 }
      }
    }
  ]
}"#;

/// Та же квартира, собранная напрямую в core-типах — зеркало
/// flatplan_golden.rs, но с явными paint_coats: Some(2) как в PWA-фикстуре.
fn flatplan_core() -> core::Project {
    use core::model::CeilingWork;
    use core::*;

    let door = |w: f64, h: f64| Opening {
        kind: OpeningKind::Door,
        width_m: w,
        height_m: h,
    };
    let window = |w: f64, h: f64| Opening {
        kind: OpeningKind::Window,
        width_m: w,
        height_m: h,
    };
    let passage = |w: f64, h: f64| Opening {
        kind: OpeningKind::Passage,
        width_m: w,
        height_m: h,
    };

    let works = |finish: FloorFinish, wall_paint: Option<u8>| Works {
        floor: Some(FloorWork {
            finish,
            tile_pattern: None,
        }),
        walls: Some(WallsWork {
            paint_coats: wall_paint,
            tile_pattern: None,
        }),
        ceiling: Some(CeilingWork {
            paint_coats: Some(2),
        }),
    };

    core::Project {
        id: "flatplan-1001-527".into(),
        title: "Квартира 53.7 м² (демо)".into(),
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
                works: works(FloorFinish::Laminate, Some(2)),
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
                works: works(FloorFinish::Laminate, Some(2)),
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
                works: works(FloorFinish::Tile, None),
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
                works: works(FloorFinish::Tile, Some(2)),
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
                    ceiling: Some(CeilingWork {
                        paint_coats: Some(2),
                    }),
                },
            },
        ],
    }
}

#[test]
fn pwa_json_deserializes_with_extra_fields_ignored() {
    let input: dto::ProjectInput =
        serde_json::from_str(FLATPLAN_JSON).expect("PWA-форма JSON должна парситься");
    assert_eq!(input.rooms.len(), 5);
    let bathroom = &input.rooms[2];
    assert!(bathroom.wet);
    assert_eq!(bathroom.wet_zone_height_m, Some(2.0));
    // balcony: walls отсутствует → None (а не пустой struct).
    assert!(input.rooms[4].works.walls.is_none());
    // bathroom: walls = {} → Some с дефолтами (ядро решит плитку по wet).
    assert!(bathroom.works.walls.is_some());
}

#[test]
fn dto_path_equals_direct_core_path() {
    let input: dto::ProjectInput = serde_json::from_str(FLATPLAN_JSON).unwrap();
    let via_dto: core::Project = input.into();
    let direct = flatplan_core();

    let a = core::estimates_for_project(&via_dto);
    let b = core::estimates_for_project(&direct);

    assert_eq!(a.len(), b.len(), "число оценок разошлось");
    for (x, y) in a.iter().zip(b.iter()) {
        assert_eq!(x.material, y.material);
        assert_eq!(x.room_id, y.room_id);
        assert_eq!(x.stage, y.stage);
        assert_eq!(x.driving_measure, y.driving_measure);
        // Один и тот же код-путь → битовое равенство f64 обязано держаться.
        assert_eq!(
            x.driving_measure_value, y.driving_measure_value,
            "{}/{}: driving",
            x.room_id,
            x.material.key()
        );
        assert_eq!(x.quantity, y.quantity, "{}/{}", x.room_id, x.material.key());
        assert_eq!(x.applied_per_unit, y.applied_per_unit);
        assert_eq!(x.applied_waste, y.applied_waste);
        assert_eq!(x.applied_assumptions, y.applied_assumptions);
    }
}

#[test]
fn estimate_response_serializes_camel_case_with_stable_keys() {
    let input: dto::ProjectInput = serde_json::from_str(FLATPLAN_JSON).unwrap();
    let project: core::Project = input.into();
    let estimates: Vec<dto::MaterialEstimate> = core::estimates_for_project(&project)
        .into_iter()
        .map(Into::into)
        .collect();

    let v = serde_json::to_value(&estimates).unwrap();
    let first = &v[0];
    // camelCase-поля контракта TS-стороны.
    for key in [
        "materialKey",
        "roomId",
        "stage",
        "drivingMeasure",
        "drivingMeasureValue",
        "quantity",
        "unit",
        "appliedPerUnit",
        "appliedWaste",
        "appliedAssumptions",
        "normSetLabel",
    ] {
        assert!(first.get(key).is_some(), "нет ключа {key}: {first}");
    }
    // Стабильные ключи enum-значений = key() ядра.
    let mats: Vec<&str> = v
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["materialKey"].as_str().unwrap())
        .collect();
    assert!(mats.contains(&"floor-leveler"), "kebab-case material key");
    assert!(mats.contains(&"wall-tile"));
    let stages: Vec<&str> = v
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["stage"].as_str().unwrap())
        .collect();
    assert!(stages.contains(&"wall-ceiling-finish"), "kebab-case stage");
    // Гидроизоляция ванной несёт upstand в допущениях (reconciliation).
    let wp = v
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["materialKey"] == "waterproofing")
        .expect("в мокрой ванной должна быть гидроизоляция");
    assert_eq!(wp["appliedAssumptions"]["upstandHeightMm"], 2000.0);
    // Заход задан явно (wetZoneHeightM: 2.0) → НЕ unvalidated-дефолт.
    assert_eq!(wp["quantity"]["confidence"], "medium");
    // Честность Risk #1: seed-нормы без замеров (клей без зуба) — unvalidated.
    let adhesive = v
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["materialKey"] == "tile-adhesive")
        .expect("плиточные комнаты должны дать клей");
    assert_eq!(adhesive["quantity"]["confidence"], "unvalidated");
}
