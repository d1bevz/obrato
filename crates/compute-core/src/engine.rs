//! Движок: состав работ комнаты → оценки материалов с диапазоном.
//!
//! Контракт выхода — гл.05 §8 (MaterialEstimate-core): material(key), stage,
//! driving_measure(+value), quantity: NormValue, unit, применённые
//! коэффициенты и допущения. Без SyncMeta/org — это добавляет app-слой.
//!
//! Правило композиции диапазонов (гл.05 §8, дословно):
//!   quantity.central = D × per_unit.central × (1 + waste.central)
//!   quantity.lo      = D × per_unit.lo      × (1 + waste.central)
//!   quantity.hi      = D × per_unit.hi      × (1 + waste.hi)
//! НЕ компаундить lo×lo / hi×hi — наивное перемножение границ систематически
//! раздувает диапазон.

use crate::formulas;
use crate::geometry;
use crate::materials::{DrivingMeasure, MaterialKind, Stage, Unit};
use crate::model::{FloorFinish, LayoutPattern, Project, Room};
use crate::norms::{Confidence, DEFAULT_UPSTAND_M, NormAssumptions, NormValue};

/// Метка seed-набора норм (пин версии, гл.05 §3 NormSet). Ядро не ходит в
/// калибровку — резолв эффективных коэффициентов делает app-слой; на M0
/// зашит global seed v1 (значения гл.07).
pub const NORM_SET_LABEL: &str = "global-seed-v1-ch07";

/// Оценка по одному материалу в одной комнате — ВЫХОД ядра (гл.05 §8).
#[derive(Debug, Clone)]
pub struct MaterialEstimate {
    pub material: MaterialKind,
    pub room_id: String,
    pub stage: Stage,
    pub driving_measure: DrivingMeasure,
    /// Снапшот геометрии на момент оценки (воспроизводимость, гл.05 §3).
    pub driving_measure_value: f64,
    /// Количество-диапазон ДО округления до фасовок (упаковки — слайс 1).
    pub quantity: NormValue,
    pub unit: Unit,
    /// Применённые коэффициенты — для reconciliation (гл.05 §3).
    pub applied_per_unit: NormValue,
    pub applied_waste: NormValue,
    pub applied_assumptions: NormAssumptions,
    pub norm_set_label: &'static str,
}

/// Композиция диапазонов по правилу гл.05 §8.
/// Confidence результата = минимум из confidence входов (худшее звено).
pub fn compose_quantity(driving: f64, per_unit: NormValue, waste: NormValue) -> NormValue {
    let q = NormValue {
        central: driving * per_unit.central * (1.0 + waste.central),
        lo: driving * per_unit.lo * (1.0 + waste.central),
        hi: driving * per_unit.hi * (1.0 + waste.hi),
        confidence: per_unit.confidence.min(waste.confidence),
    };
    debug_assert!(
        q.lo <= q.central && q.central <= q.hi,
        "compose_quantity: инвариант lo <= central <= hi нарушен (вход: per_unit/waste с инвертированными границами?)"
    );
    q
}

#[allow(clippy::too_many_arguments)] // внутренний конструктор: все поля контракта гл.05 §8 явные
fn estimate(
    room: &Room,
    material: MaterialKind,
    stage: Stage,
    driving_measure: DrivingMeasure,
    driving_value: f64,
    per_unit: NormValue,
    waste: NormValue,
    unit: Unit,
    assumptions: NormAssumptions,
) -> MaterialEstimate {
    MaterialEstimate {
        material,
        room_id: room.id.clone(),
        stage,
        driving_measure,
        driving_measure_value: driving_value,
        quantity: compose_quantity(driving_value, per_unit, waste),
        unit,
        applied_per_unit: per_unit,
        applied_waste: waste,
        applied_assumptions: assumptions,
        norm_set_label: NORM_SET_LABEL,
    }
}

/// Плитка + клей + затирка на заданную площадь (пол или стены).
fn tiling_set(
    out: &mut Vec<MaterialEstimate>,
    room: &Room,
    tile_material: MaterialKind,
    driving_measure: DrivingMeasure,
    area: f64,
    pattern: LayoutPattern,
) {
    // Плитка: coverage 1.0, отход по паттерну (гл.07 §1.7).
    let tile_assumptions = NormAssumptions {
        layout_pattern: Some(pattern),
        ..Default::default()
    };
    let tile_waste = crate::norms::tile_waste_factor(pattern);
    out.push(estimate(
        room,
        tile_material,
        Stage::Tiling,
        driving_measure,
        area,
        formulas::tile_per_unit(),
        tile_waste,
        Unit::M2,
        tile_assumptions,
    ));
    // Клей: зуб гладилки неизвестен на M0 → seed-диапазон (гл.07 §1.1).
    let (adhesive_pu, adhesive_assumptions) = formulas::adhesive_per_unit(None, None, false);
    out.push(estimate(
        room,
        MaterialKind::TileAdhesive,
        Stage::Tiling,
        driving_measure,
        area,
        adhesive_pu,
        formulas::bulk_waste(),
        Unit::Kg,
        adhesive_assumptions,
    ));
    // Затирка: формат плитки неизвестен на M0 → seed-диапазон (гл.07 §1.2).
    let (grout_pu, grout_assumptions) = formulas::grout_per_unit(None, None, 1.6);
    out.push(estimate(
        room,
        MaterialKind::Grout,
        Stage::Tiling,
        driving_measure,
        area,
        grout_pu,
        formulas::bulk_waste(),
        Unit::Kg,
        grout_assumptions,
    ));
}

/// Грунт + краска на заданную площадь (стены или потолок).
fn paint_set(
    out: &mut Vec<MaterialEstimate>,
    room: &Room,
    driving_measure: DrivingMeasure,
    area: f64,
    coats: Option<u8>,
) {
    let (primer_pu, primer_assumptions) = formulas::primer_per_unit();
    out.push(estimate(
        room,
        MaterialKind::Primer,
        Stage::WallCeilingFinish,
        driving_measure,
        area,
        primer_pu,
        formulas::bulk_waste(),
        Unit::L,
        primer_assumptions,
    ));
    let (paint_pu, paint_assumptions) = formulas::paint_per_unit(coats);
    out.push(estimate(
        room,
        MaterialKind::Paint,
        Stage::WallCeilingFinish,
        driving_measure,
        area,
        paint_pu,
        formulas::bulk_waste(),
        Unit::L,
        paint_assumptions,
    ));
}

/// Состав работ комнаты → оценки материалов.
///
/// Ветвление (гл.08 §3.2/§3.3): пол по finish; стены — плитка при wet, иначе
/// краска; потолок — краска; wet → гидроизоляция (площадь = пол + заход).
/// Ламинат/винил сами — вне 10 материалов (закупка вне каталога); ядро для
/// них считает подготовку (ровнитель) и плинтус.
pub fn estimates_for_room(room: &Room) -> Vec<MaterialEstimate> {
    let mut out = Vec::new();
    let floor = geometry::floor_area_m2(room);
    let walls = geometry::wall_area_m2(room);
    let ceiling = geometry::ceiling_area_m2(room);

    if let Some(fw) = room.works.floor {
        if fw.finish != FloorFinish::None {
            // Подготовка: наливной пол (autonivelante) по умолчанию.
            // Betonilha (screed-mix) — выбор по состоянию основания (Risk #1),
            // в модели ввода Д×Ш×В этого входа нет — гл.07 §1.4.
            let (leveler_pu, leveler_assumptions) = formulas::floor_leveler_per_unit(None, None);
            out.push(estimate(
                room,
                MaterialKind::FloorLeveler,
                Stage::Screed,
                DrivingMeasure::FloorAreaM2,
                floor,
                leveler_pu,
                formulas::bulk_waste(),
                Unit::Kg,
                leveler_assumptions,
            ));
        }

        if room.wet {
            // Гидроизоляция: площадь = пол + периметр × заход (гл.07 §1.3).
            let (wp_area, upstand_m, defaulted) =
                geometry::waterproofing_area_m2(room, DEFAULT_UPSTAND_M);
            let (mut wp_pu, mut wp_assumptions) = formulas::waterproofing_per_unit(None);
            wp_assumptions.upstand_height_mm = Some(upstand_m * 1000.0);
            if defaulted {
                // Заход взят дефолтом — Risk #1-вход (гл.07 §3.4).
                wp_pu.confidence = Confidence::Unvalidated;
                wp_assumptions.free_notes.push(
                    "высота захода взята дефолтом 2.0 м — уточнить разметкой мокрой зоны"
                        .to_string(),
                );
            }
            out.push(estimate(
                room,
                MaterialKind::Waterproofing,
                Stage::Waterproofing,
                DrivingMeasure::WaterproofingAreaM2,
                wp_area,
                wp_pu,
                formulas::bulk_waste(),
                Unit::Kg,
                wp_assumptions,
            ));
        }

        match fw.finish {
            FloorFinish::Tile => {
                let pattern = fw.tile_pattern.unwrap_or(LayoutPattern::Straight);
                tiling_set(
                    &mut out,
                    room,
                    MaterialKind::FloorTile,
                    DrivingMeasure::FloorAreaM2,
                    floor,
                    pattern,
                );
            }
            FloorFinish::Laminate | FloorFinish::Vinyl => {
                // Само покрытие — вне каталога 10 материалов (Stage::Flooring
                // остаётся пустым на M0; закупается отдельно).
            }
            FloorFinish::None => {}
        }

        // Плинтус: ось laminate/vinyl → flooring (гл.08 §3.3); количество =
        // периметр − двери (гл.07 §1.6). Плиточный пол получает rodapé
        // cerâmico в составе tiling-работ, не MDF-плинтус.
        if !room.wet && matches!(fw.finish, FloorFinish::Laminate | FloorFinish::Vinyl) {
            let baseboard_len = geometry::baseboard_length_m(room);
            out.push(estimate(
                room,
                MaterialKind::Baseboard,
                Stage::Flooring,
                DrivingMeasure::PerimeterM,
                baseboard_len,
                formulas::baseboard_per_unit(),
                formulas::baseboard_waste(),
                Unit::M,
                NormAssumptions::default(),
            ));
        }
    }

    if let Some(ww) = room.works.walls {
        if room.wet {
            tiling_set(
                &mut out,
                room,
                MaterialKind::WallTile,
                DrivingMeasure::WallAreaM2,
                walls,
                ww.tile_pattern.unwrap_or(LayoutPattern::Straight),
            );
        } else {
            paint_set(
                &mut out,
                room,
                DrivingMeasure::WallAreaM2,
                walls,
                ww.paint_coats,
            );
        }
    }

    if let Some(cw) = room.works.ceiling {
        paint_set(
            &mut out,
            room,
            DrivingMeasure::CeilingAreaM2,
            ceiling,
            cw.paint_coats,
        );
    }

    out
}

/// Оценки по всему проекту, в каноническом порядке этапов (гл.05 §5).
pub fn estimates_for_project(project: &Project) -> Vec<MaterialEstimate> {
    let mut all: Vec<MaterialEstimate> =
        project.rooms.iter().flat_map(estimates_for_room).collect();
    all.sort_by_key(|e| e.stage);
    all
}
