//! Материалы и этапы — стабильные ключи контракта (гл.05 §4: Material.key —
//! join-ключ ядра; гл.05 §5: канонический порядок этапов).

/// 10 материалов пилота (= ключи NormRule, гл.07 / гл.10 §2).
/// floor-leveler (autonivelante, kg/м²/ММ) и screed-mix (betonilha, kg/м²/СМ) —
/// два РАЗНЫХ класса продукта (~10× расход на мм), гл.07 §1.4.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MaterialKind {
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

impl MaterialKind {
    /// Стабильный slug — совпадает с `Material.key` каталога (seed.json)
    /// и MaterialKind TS-прототипа.
    pub fn key(self) -> &'static str {
        match self {
            MaterialKind::FloorTile => "floor-tile",
            MaterialKind::WallTile => "wall-tile",
            MaterialKind::TileAdhesive => "tile-adhesive",
            MaterialKind::Grout => "grout",
            MaterialKind::Paint => "paint",
            MaterialKind::Primer => "primer",
            MaterialKind::FloorLeveler => "floor-leveler",
            MaterialKind::ScreedMix => "screed-mix",
            MaterialKind::Waterproofing => "waterproofing",
            MaterialKind::Baseboard => "baseboard",
        }
    }
}

/// Базовые единицы материалов.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Unit {
    M2,
    Kg,
    L,
    M,
    Pcs,
}

impl Unit {
    pub fn key(self) -> &'static str {
        match self {
            Unit::M2 => "m2",
            Unit::Kg => "kg",
            Unit::L => "l",
            Unit::M => "m",
            Unit::Pcs => "pcs",
        }
    }
}

/// Канонический порядок этапов стройки (гл.05 §5) — драйвит группировку
/// листа закупок.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Stage {
    Demolition,
    RoughPlumbingElectric,
    Screed,
    Waterproofing,
    Tiling,
    WallCeilingFinish,
    Flooring,
    Final,
}

impl Stage {
    pub fn key(self) -> &'static str {
        match self {
            Stage::Demolition => "demolition",
            Stage::RoughPlumbingElectric => "rough-plumbing-electric",
            Stage::Screed => "screed",
            Stage::Waterproofing => "waterproofing",
            Stage::Tiling => "tiling",
            Stage::WallCeilingFinish => "wall-ceiling-finish",
            Stage::Flooring => "flooring",
            Stage::Final => "final",
        }
    }
}

/// Ведущая мера коэффициента (гл.05 §3 NormRule.driving_measure).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DrivingMeasure {
    FloorAreaM2,
    WallAreaM2,
    CeilingAreaM2,
    PerimeterM,
    WetFloorAreaM2,
    /// Пол + периметр × заход (upstand) — гл.07 §1.3.
    WaterproofingAreaM2,
}
