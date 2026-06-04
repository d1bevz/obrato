//! DTO Границы A (гл.09 §2): зеркала модели ядра с serde + tsify.
//!
//! Ключи — контракт TS-стороны (apps/pwa): поля camelCase, enum-значения
//! lowercase/kebab-case, совпадающие с `key()` ядра (materials.rs). TS-типы
//! генерятся из этих структур (D3/D4): меняешь поле здесь → фронт перестаёт
//! компилиться.
//!
//! Вниз (App → ядро) идут ЧИСТЫЕ ДАННЫЕ (ProjectInput без sync/org_id —
//! лишние поля JSON игнорируются serde). Вверх — эфемерный
//! Vec<MaterialEstimate-core> без identity/SyncMeta (гл.09 §2).

use compute_core as cc;
use serde::{Deserialize, Serialize};
use tsify::Tsify;

// ---------------------------------------------------------------------------
// Вниз: ProjectInput (модель ввода, зеркало cc::model)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "lowercase")]
pub enum RoomType {
    Bathroom,
    Kitchen,
    Bedroom,
    Living,
    Hallway,
    Other,
}

impl From<RoomType> for cc::RoomType {
    fn from(v: RoomType) -> Self {
        match v {
            RoomType::Bathroom => cc::RoomType::Bathroom,
            RoomType::Kitchen => cc::RoomType::Kitchen,
            RoomType::Bedroom => cc::RoomType::Bedroom,
            RoomType::Living => cc::RoomType::Living,
            RoomType::Hallway => cc::RoomType::Hallway,
            RoomType::Other => cc::RoomType::Other,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "lowercase")]
pub enum OpeningKind {
    Door,
    Window,
    Passage,
}

impl From<OpeningKind> for cc::OpeningKind {
    fn from(v: OpeningKind) -> Self {
        match v {
            OpeningKind::Door => cc::OpeningKind::Door,
            OpeningKind::Window => cc::OpeningKind::Window,
            OpeningKind::Passage => cc::OpeningKind::Passage,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Opening {
    pub kind: OpeningKind,
    pub width_m: f64,
    pub height_m: f64,
}

impl From<Opening> for cc::Opening {
    fn from(v: Opening) -> Self {
        cc::Opening {
            kind: v.kind.into(),
            width_m: v.width_m,
            height_m: v.height_m,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "lowercase")]
pub enum FloorFinish {
    Tile,
    Laminate,
    Vinyl,
    None,
}

impl From<FloorFinish> for cc::FloorFinish {
    fn from(v: FloorFinish) -> Self {
        match v {
            FloorFinish::Tile => cc::FloorFinish::Tile,
            FloorFinish::Laminate => cc::FloorFinish::Laminate,
            FloorFinish::Vinyl => cc::FloorFinish::Vinyl,
            FloorFinish::None => cc::FloorFinish::None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "lowercase")]
pub enum LayoutPattern {
    Straight,
    Brick,
    Diagonal,
    Herringbone,
}

impl From<LayoutPattern> for cc::LayoutPattern {
    fn from(v: LayoutPattern) -> Self {
        match v {
            LayoutPattern::Straight => cc::LayoutPattern::Straight,
            LayoutPattern::Brick => cc::LayoutPattern::Brick,
            LayoutPattern::Diagonal => cc::LayoutPattern::Diagonal,
            LayoutPattern::Herringbone => cc::LayoutPattern::Herringbone,
        }
    }
}

impl From<cc::LayoutPattern> for LayoutPattern {
    fn from(v: cc::LayoutPattern) -> Self {
        match v {
            cc::LayoutPattern::Straight => LayoutPattern::Straight,
            cc::LayoutPattern::Brick => LayoutPattern::Brick,
            cc::LayoutPattern::Diagonal => LayoutPattern::Diagonal,
            cc::LayoutPattern::Herringbone => LayoutPattern::Herringbone,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct FloorWork {
    pub finish: FloorFinish,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tile_pattern: Option<LayoutPattern>,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct WallsWork {
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paint_coats: Option<u8>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tile_pattern: Option<LayoutPattern>,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct CeilingWork {
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paint_coats: Option<u8>,
}

/// Состав работ — 4 галочки минус электрика: точки электрики живут на
/// app-слое (шаблоны), материалов из 10 видов не порождают (гл.05 §2);
/// лишний ключ `electricPoints` из PWA-типов здесь игнорируется serde.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Works {
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub floor: Option<FloorWork>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub walls: Option<WallsWork>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ceiling: Option<CeilingWork>,
}

impl From<Works> for cc::Works {
    fn from(v: Works) -> Self {
        cc::Works {
            floor: v.floor.map(|f| cc::FloorWork {
                finish: f.finish.into(),
                tile_pattern: f.tile_pattern.map(Into::into),
            }),
            walls: v.walls.map(|w| cc::WallsWork {
                paint_coats: w.paint_coats,
                tile_pattern: w.tile_pattern.map(Into::into),
            }),
            ceiling: v
                .ceiling
                .map(|c| cc::model::CeilingWork { paint_coats: c.paint_coats }),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    /// id нужен только для join оценок к комнате (MaterialEstimate.room_id) —
    /// это НЕ sync-identity (гл.09 §2: вниз идут чистые данные).
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub room_type: RoomType,
    pub length_m: f64,
    pub width_m: f64,
    pub height_m: f64,
    pub wet: bool,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wet_zone_height_m: Option<f64>,
    #[serde(default)]
    pub openings: Vec<Opening>,
    #[serde(default)]
    pub works: Works,
}

impl From<Room> for cc::Room {
    fn from(v: Room) -> Self {
        cc::Room {
            id: v.id,
            name: v.name,
            room_type: v.room_type.into(),
            length_m: v.length_m,
            width_m: v.width_m,
            height_m: v.height_m,
            wet: v.wet,
            wet_zone_height_m: v.wet_zone_height_m,
            openings: v.openings.into_iter().map(Into::into).collect(),
            works: v.works.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[tsify(from_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub id: String,
    pub title: String,
    pub rooms: Vec<Room>,
}

impl From<ProjectInput> for cc::Project {
    fn from(v: ProjectInput) -> Self {
        cc::Project {
            id: v.id,
            title: v.title,
            rooms: v.rooms.into_iter().map(Into::into).collect(),
        }
    }
}

// ---------------------------------------------------------------------------
// Вверх: MaterialEstimate-core (контракт гл.05 §8), эфемерный
// ---------------------------------------------------------------------------

/// Стабильные ключи материалов = `MaterialKind::key()` ядра = `Material.key`
/// каталога seed.json.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "kebab-case")]
pub enum MaterialKey {
    FloorTile,
    WallTile,
    TileAdhesive,
    Grout,
    Paint,
    Primer,
    FloorLeveler,
    ScreedMix,
    Waterproofing,
    Baseboard,
}

impl From<cc::MaterialKind> for MaterialKey {
    fn from(v: cc::MaterialKind) -> Self {
        match v {
            cc::MaterialKind::FloorTile => MaterialKey::FloorTile,
            cc::MaterialKind::WallTile => MaterialKey::WallTile,
            cc::MaterialKind::TileAdhesive => MaterialKey::TileAdhesive,
            cc::MaterialKind::Grout => MaterialKey::Grout,
            cc::MaterialKind::Paint => MaterialKey::Paint,
            cc::MaterialKind::Primer => MaterialKey::Primer,
            cc::MaterialKind::FloorLeveler => MaterialKey::FloorLeveler,
            cc::MaterialKind::ScreedMix => MaterialKey::ScreedMix,
            cc::MaterialKind::Waterproofing => MaterialKey::Waterproofing,
            cc::MaterialKind::Baseboard => MaterialKey::Baseboard,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "kebab-case")]
pub enum StageKey {
    Demolition,
    RoughPlumbingElectric,
    Screed,
    Waterproofing,
    Tiling,
    WallCeilingFinish,
    Flooring,
    Final,
}

impl From<cc::Stage> for StageKey {
    fn from(v: cc::Stage) -> Self {
        match v {
            cc::Stage::Demolition => StageKey::Demolition,
            cc::Stage::RoughPlumbingElectric => StageKey::RoughPlumbingElectric,
            cc::Stage::Screed => StageKey::Screed,
            cc::Stage::Waterproofing => StageKey::Waterproofing,
            cc::Stage::Tiling => StageKey::Tiling,
            cc::Stage::WallCeilingFinish => StageKey::WallCeilingFinish,
            cc::Stage::Flooring => StageKey::Flooring,
            cc::Stage::Final => StageKey::Final,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "lowercase")]
pub enum UnitKey {
    M2,
    Kg,
    L,
    M,
    Pcs,
}

impl From<cc::Unit> for UnitKey {
    fn from(v: cc::Unit) -> Self {
        match v {
            cc::Unit::M2 => UnitKey::M2,
            cc::Unit::Kg => UnitKey::Kg,
            cc::Unit::L => UnitKey::L,
            cc::Unit::M => UnitKey::M,
            cc::Unit::Pcs => UnitKey::Pcs,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "kebab-case")]
pub enum DrivingMeasure {
    FloorAreaM2,
    WallAreaM2,
    CeilingAreaM2,
    PerimeterM,
    WetFloorAreaM2,
    WaterproofingAreaM2,
}

impl From<cc::DrivingMeasure> for DrivingMeasure {
    fn from(v: cc::DrivingMeasure) -> Self {
        match v {
            cc::DrivingMeasure::FloorAreaM2 => DrivingMeasure::FloorAreaM2,
            cc::DrivingMeasure::WallAreaM2 => DrivingMeasure::WallAreaM2,
            cc::DrivingMeasure::CeilingAreaM2 => DrivingMeasure::CeilingAreaM2,
            cc::DrivingMeasure::PerimeterM => DrivingMeasure::PerimeterM,
            cc::DrivingMeasure::WetFloorAreaM2 => DrivingMeasure::WetFloorAreaM2,
            cc::DrivingMeasure::WaterproofingAreaM2 => DrivingMeasure::WaterproofingAreaM2,
        }
    }
}

/// Уровень НОРМЫ (`NormValue.confidence`) — не путать с уровнем КОЛИЧЕСТВА
/// листа (`QuantityEstimate.confidence`, появится с packaging на P3) —
/// гл.08 §4: два разных confidence-энума.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    Unvalidated,
    Low,
    Medium,
    High,
}

impl From<cc::Confidence> for Confidence {
    fn from(v: cc::Confidence) -> Self {
        match v {
            cc::Confidence::Unvalidated => Confidence::Unvalidated,
            cc::Confidence::Low => Confidence::Low,
            cc::Confidence::Medium => Confidence::Medium,
            cc::Confidence::High => Confidence::High,
        }
    }
}

/// Величина-с-неопределённостью (D7): central — headline, lo/hi — границы.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct NormValue {
    pub central: f64,
    pub lo: f64,
    pub hi: f64,
    pub confidence: Confidence,
}

impl From<cc::NormValue> for NormValue {
    fn from(v: cc::NormValue) -> Self {
        NormValue {
            central: v.central,
            lo: v.lo,
            hi: v.hi,
            confidence: v.confidence.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "lowercase")]
pub enum TrowelProfile {
    Square,
    U,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "lowercase")]
pub enum SubstrateFlatness {
    Good,
    Medium,
    Poor,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "lowercase")]
pub enum SubstrateAbsorbency {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "kebab-case")]
pub enum TileFormatClass {
    Small,
    Medium,
    Large,
    XlSlab,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct TileFormat {
    pub a_mm: f64,
    pub b_mm: f64,
    pub thickness_mm: f64,
}

/// Структурные допущения коэффициента (гл.05 §3) — для тултипа допущений
/// (NormRangeView) и reconciliation.
#[derive(Debug, Clone, Default, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct NormAssumptions {
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trowel_notch_mm: Option<f64>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trowel_profile: Option<TrowelProfile>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout_pattern: Option<LayoutPattern>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tile_format_class: Option<TileFormatClass>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tile_format: Option<TileFormat>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub joint_width_mm: Option<f64>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub coats: Option<u8>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layer_thickness_mm: Option<f64>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub substrate_flatness: Option<SubstrateFlatness>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub substrate_absorbency: Option<SubstrateAbsorbency>,
    #[tsify(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstand_height_mm: Option<f64>,
    #[serde(default)]
    pub free_notes: Vec<String>,
}

impl From<cc::NormAssumptions> for NormAssumptions {
    fn from(v: cc::NormAssumptions) -> Self {
        use compute_core::norms as cn;
        NormAssumptions {
            trowel_notch_mm: v.trowel_notch_mm,
            trowel_profile: v.trowel_profile.map(|p| match p {
                cn::TrowelProfile::Square => TrowelProfile::Square,
                cn::TrowelProfile::U => TrowelProfile::U,
            }),
            layout_pattern: v.layout_pattern.map(Into::into),
            tile_format_class: v.tile_format_class.map(|c| match c {
                cn::TileFormatClass::Small => TileFormatClass::Small,
                cn::TileFormatClass::Medium => TileFormatClass::Medium,
                cn::TileFormatClass::Large => TileFormatClass::Large,
                cn::TileFormatClass::XlSlab => TileFormatClass::XlSlab,
            }),
            tile_format: v.tile_format.map(|f| TileFormat {
                a_mm: f.a_mm,
                b_mm: f.b_mm,
                thickness_mm: f.thickness_mm,
            }),
            joint_width_mm: v.joint_width_mm,
            coats: v.coats,
            layer_thickness_mm: v.layer_thickness_mm,
            substrate_flatness: v.substrate_flatness.map(|s| match s {
                cn::SubstrateFlatness::Good => SubstrateFlatness::Good,
                cn::SubstrateFlatness::Medium => SubstrateFlatness::Medium,
                cn::SubstrateFlatness::Poor => SubstrateFlatness::Poor,
                cn::SubstrateFlatness::Unknown => SubstrateFlatness::Unknown,
            }),
            substrate_absorbency: v.substrate_absorbency.map(|s| match s {
                cn::SubstrateAbsorbency::Low => SubstrateAbsorbency::Low,
                cn::SubstrateAbsorbency::Medium => SubstrateAbsorbency::Medium,
                cn::SubstrateAbsorbency::High => SubstrateAbsorbency::High,
            }),
            upstand_height_mm: v.upstand_height_mm,
            free_notes: v.free_notes,
        }
    }
}

/// Оценка по одному материалу в одной комнате — контракт гл.05 §8, эфемерный
/// (recomputable), без identity/SyncMeta.
#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[serde(rename_all = "camelCase")]
pub struct MaterialEstimate {
    pub material_key: MaterialKey,
    pub room_id: String,
    pub stage: StageKey,
    pub driving_measure: DrivingMeasure,
    pub driving_measure_value: f64,
    /// Количество-диапазон ДО округления до фасовок (packaging — P3).
    pub quantity: NormValue,
    pub unit: UnitKey,
    pub applied_per_unit: NormValue,
    pub applied_waste: NormValue,
    pub applied_assumptions: NormAssumptions,
    pub norm_set_label: String,
}

impl From<cc::MaterialEstimate> for MaterialEstimate {
    fn from(e: cc::MaterialEstimate) -> Self {
        MaterialEstimate {
            material_key: e.material.into(),
            room_id: e.room_id,
            stage: e.stage.into(),
            driving_measure: e.driving_measure.into(),
            driving_measure_value: e.driving_measure_value,
            quantity: e.quantity.into(),
            unit: e.unit.into(),
            applied_per_unit: e.applied_per_unit.into(),
            applied_waste: e.applied_waste.into(),
            applied_assumptions: e.applied_assumptions.into(),
            norm_set_label: e.norm_set_label.to_string(),
        }
    }
}

/// Ответ ядра одним конвертом (гл.09 §2: управляющие метаданные — request_id/
/// status — добавляет worker-обвязка, не ядро).
#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct EstimateResponse {
    pub engine_version: String,
    pub norm_set_label: String,
    pub estimates: Vec<MaterialEstimate>,
}
