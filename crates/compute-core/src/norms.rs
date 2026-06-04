//! Нормы: величина-с-неопределённостью (NormValue), структурные допущения
//! (NormAssumptions) и seed-набор правил.
//!
//! Источник истины: гл.05 §3 (NormValue/NormAssumptions/NormRule) и гл.07
//! (формулы + seed-значения). Центральный тезис (гл.07 §0): движок отдаёт
//! «формула(детерминированные входы) → диапазон + флаг калибровки», НЕ точку.

use crate::model::LayoutPattern;

/// Уровень доверия к величине. Seed стартует Unvalidated (честность Risk #1,
/// гл.05 §3) и сужается только данными реальных закупок.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Confidence {
    Unvalidated,
    Low,
    Medium,
    High,
}

/// Величина-с-неопределённостью (ядро D7). central — headline, lo/hi — границы.
/// lo == central == hi допустимо для стабильных величин (плитка coverage 1.0).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct NormValue {
    pub central: f64,
    pub lo: f64,
    pub hi: f64,
    pub confidence: Confidence,
}

impl NormValue {
    pub fn point(v: f64, confidence: Confidence) -> Self {
        NormValue {
            central: v,
            lo: v,
            hi: v,
            confidence,
        }
    }

    pub fn range(central: f64, lo: f64, hi: f64, confidence: Confidence) -> Self {
        debug_assert!(
            lo <= central && central <= hi,
            "NormValue: lo <= central <= hi"
        );
        NormValue {
            central,
            lo,
            hi,
            confidence,
        }
    }

    /// Масштабирование диапазона константой (например, на толщину слоя).
    /// Только неотрицательные множители — отрицательный k инвертировал бы границы.
    pub fn scale(self, k: f64) -> Self {
        debug_assert!(k >= 0.0, "NormValue::scale: множитель должен быть >= 0");
        NormValue {
            central: self.central * k,
            lo: self.lo * k,
            hi: self.hi * k,
            confidence: self.confidence,
        }
    }
}

/// Профиль зуба гладилки: эфф. толщина клея = зуб/2 (Square) или зуб/3 (U) —
/// гл.07 §1.1.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrowelProfile {
    Square,
    U,
}

/// Ровность основания — НЕ выводимо из Д×Ш×В (гл.07 §3.1), канонический
/// «норма соврёт здесь». Default Unknown → широкий диапазон.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubstrateFlatness {
    Good,
    Medium,
    Poor,
    Unknown,
}

/// Впитываемость основания — драйвит rendimento краски (гл.07 §1.5).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubstrateAbsorbency {
    Low,
    Medium,
    High,
}

/// Класс формата плитки (гл.05 §3); точный формат A×B×C — в TileFormat.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TileFormatClass {
    Small,
    Medium,
    Large,
    XlSlab,
}

/// Точный формат плитки для формулы затирки (гл.07 §1.2): A×B мм, толщина C мм.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TileFormat {
    pub a_mm: f64,
    pub b_mm: f64,
    pub thickness_mm: f64,
}

/// Структурные условия коэффициента — замена free-text (гл.05 §3).
/// Каждое поле физически меняет расход (маппинг — гл.07 §2).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct NormAssumptions {
    /// Клей: главный драйвер kg/m² (×½ зуба для квадратного, ×⅓ для U).
    pub trowel_notch_mm: Option<f64>,
    /// Профиль зуба гладилки (Square/U) — делитель эфф. толщины клея.
    pub trowel_profile: Option<TrowelProfile>,
    /// Плитка: драйвит waste range (straight 10% → herringbone 18%).
    pub layout_pattern: Option<LayoutPattern>,
    /// Класс формата (влияет на клей косвенно).
    pub tile_format_class: Option<TileFormatClass>,
    /// Точный формат A×B×C для формулы затирки.
    pub tile_format: Option<TileFormat>,
    /// Затирка: ширина шва, мм (Risk #1 — функция калибра партии).
    pub joint_width_mm: Option<f64>,
    /// Слои краски/грунта/гидро.
    pub coats: Option<u8>,
    /// Толщина слоя: ровнитель (мм) / стяжка (см) / гидро DFT (мм). Risk #1.
    pub layer_thickness_mm: Option<f64>,
    pub substrate_flatness: Option<SubstrateFlatness>,
    pub substrate_absorbency: Option<SubstrateAbsorbency>,
    /// Гидроизоляция: применённая высота захода на стены, мм (Risk #1).
    pub upstand_height_mm: Option<f64>,
    /// Escape-hatch; структурные поля «выпускаются» отсюда со временем.
    pub free_notes: Vec<String>,
}

/// Дефолт высоты захода гидроизоляции, м — когда прораб не задал
/// `Room.wet_zone_height_m` (шаблон bathroom ≈ 2.0, гл.05 §2). Unvalidated.
pub const DEFAULT_UPSTAND_M: f64 = 2.0;

/// Дефолтная толщина ровнителя, мм (autonivelante 1–10 мм; центр пилота).
pub const DEFAULT_LEVELER_THICKNESS_MM: f64 = 3.0;

/// Дефолтная ширина шва, мм (типовой пол 300×300, гл.07 §1.2).
pub const DEFAULT_JOINT_WIDTH_MM: f64 = 3.0;

/// Дефолтное число слоёв краски (гл.07 §1.5).
pub const DEFAULT_PAINT_COATS: u8 = 2;

/// Waste% по паттерну раскладки (гл.07 §1.7, BS 5385 via MakeCalcs).
/// Возвращает диапазон: «иерархия твёрдая, точное число — trade-practice».
pub fn tile_waste_factor(pattern: LayoutPattern) -> NormValue {
    match pattern {
        LayoutPattern::Straight => NormValue::range(0.10, 0.08, 0.12, Confidence::Medium),
        LayoutPattern::Brick => NormValue::range(0.12, 0.10, 0.14, Confidence::Medium),
        LayoutPattern::Diagonal => NormValue::range(0.15, 0.13, 0.20, Confidence::Medium),
        LayoutPattern::Herringbone => NormValue::range(0.18, 0.15, 0.20, Confidence::Medium),
    }
}
