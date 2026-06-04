//! Формулы расхода по материалам — прямой порт гл.07 («Нормы: методология»).
//!
//! Каждая функция отдаёт `per_unit: NormValue` — расход на единицу ведущей
//! меры (kg/m², L/m², m²/m²…) — и заполняет применённые допущения. Где
//! детерминированные входы известны — считаем формулой; где нет — отдаём
//! seed-диапазон с честным confidence (гл.07 §3: «только калибровкой»).
//!
//! Числа сверены с verify-правками гл.07 §4: k затирки = 1.6 (не 1.7),
//! мешок клея 20 кг (вне этого модуля), autonivelante центр 1.6 (не 1.7).

use crate::norms::{
    Confidence, DEFAULT_JOINT_WIDTH_MM, DEFAULT_LEVELER_THICKNESS_MM, DEFAULT_PAINT_COATS,
    NormAssumptions, NormValue, SubstrateFlatness, TileFormat, TrowelProfile,
};

/// § 1.1 Плиточный клей: kg/m² = плотность(kg/m²/мм) × эфф.толщина × множитель.
/// Эфф. толщина ≈ зуб/2 (квадратный зуб) или ≈ зуб/3 (U-образный) —
/// гл.07 §1.1, §4 «устоявшиеся формулы». Плотность порошка по фичам:
/// Mapei 1.2, Kerakoll 1.25 kg/m²/мм.
///
/// `double_application` — colagem dupla (формат >900 см² / влажная / фасад) ×1.5.
/// Множитель применяется только в формульной ветке: seed 3.5 [2–8] — уже
/// свёрнутый итог типового случая, стэкать ×1.5 поверх него методологически
/// неверно (выходит за seed-потолок гл.07).
pub fn adhesive_per_unit(
    trowel_notch_mm: Option<f64>,
    profile: Option<TrowelProfile>,
    double_application: bool,
) -> (NormValue, NormAssumptions) {
    let mut a = NormAssumptions::default();
    match trowel_notch_mm {
        Some(notch) => {
            let profile = profile.unwrap_or(TrowelProfile::Square);
            a.trowel_notch_mm = Some(notch);
            a.trowel_profile = Some(profile);
            let divisor = match profile {
                TrowelProfile::Square => 2.0,
                TrowelProfile::U => 3.0,
            };
            let multiplier = if double_application { 1.5 } else { 1.0 };
            let eff_thickness = notch / divisor;
            // Плотность порошка: диапазон брендов [1.2, 1.25].
            let density = NormValue::range(1.225, 1.2, 1.25, Confidence::Medium);
            let per_unit = density.scale(eff_thickness * multiplier);
            (per_unit, a)
        }
        None => {
            a.free_notes.push(
                "зуб гладилки неизвестен — seed 3.5 [2–8] kg/m² (гл.07 §1.1), уточнить по факту"
                    .to_string(),
            );
            if double_application {
                a.free_notes.push(
                    "двойное нанесение НЕ учтено в seed — учесть при калибровке по факту"
                        .to_string(),
                );
            }
            (NormValue::range(3.5, 2.0, 8.0, Confidence::Unvalidated), a)
        }
    }
}

/// § 1.2 Затирка: kg/m² = ((A+B)/(A×B)) × C × D × k.
/// A×B — формат плитки (мм), C — толщина плитки = глубина шва (мм),
/// D — ширина шва (мм), k — плотностный коэффициент БРЕНДА (Mapei = 1.6,
/// back-solve 40/40 ячеек; брать из фичи конкретного бренда, гл.07 §3.7).
pub fn grout_per_unit(
    tile_format: Option<TileFormat>,
    joint_width_mm: Option<f64>,
    brand_k: f64,
) -> (NormValue, NormAssumptions) {
    let mut a = NormAssumptions::default();
    match tile_format {
        Some(f) => {
            let d = joint_width_mm.unwrap_or(DEFAULT_JOINT_WIDTH_MM);
            a.tile_format = Some(f);
            a.joint_width_mm = Some(d);
            let central = ((f.a_mm + f.b_mm) / (f.a_mm * f.b_mm)) * f.thickness_mm * d * brand_k;
            // Ширина шва — Risk #1 (≥3× калибра партии, ANSI A108.02; известна
            // только с плиткой в руках): если она взята дефолтом, отдаём
            // диапазон по шву 2–10 мм + флаг калибровки (гл.07 §3.2).
            let (lo, hi, conf) = if joint_width_mm.is_some() {
                (central * 0.9, central * 1.1, Confidence::High)
            } else {
                a.free_notes.push(
                    "ширина шва взята дефолтом 3 мм — уточнить по калибру партии плитки (Risk #1)"
                        .to_string(),
                );
                let per_mm = central / d;
                (per_mm * 2.0, per_mm * 10.0, Confidence::Unvalidated)
            };
            (
                NormValue::range(central, lo.min(central), hi.max(central), conf),
                a,
            )
        }
        None => {
            a.free_notes.push(
                "формат плитки неизвестен — seed 0.3 [0.04–2.9] kg/m² (пол 300×300, шов 3 мм)"
                    .to_string(),
            );
            (NormValue::range(0.3, 0.04, 2.9, Confidence::Unvalidated), a)
        }
    }
}

/// § 1.3 Гидроизоляция (цементная обмазочная): кг/м² = слои × расход_на_слой;
/// инженерная константа 2 кг/м² ≈ 1 мм мокрой плёнки (Sika verbatim);
/// разброс плотностей продуктов 1.3–2.0 kg/m²/мм (back-solve).
/// Площадь считается ВНЕ этой функции (waterproofing_area_m2: пол + заход).
pub fn waterproofing_per_unit(dft_mm: Option<f64>) -> (NormValue, NormAssumptions) {
    let mut a = NormAssumptions::default();
    match dft_mm {
        Some(dft) => {
            a.layer_thickness_mm = Some(dft);
            // central по Sika-константе 2.0 kg/m²/мм; lo по нижней плотности 1.3.
            (
                NormValue::range(2.0 * dft, 1.3 * dft, 2.0 * dft, Confidence::Medium),
                a,
            )
        }
        None => {
            a.free_notes
                .push("DFT не задан — seed 3.5 [3–4.2] kg/m², ≥2 слоя (weber.dry 824)".to_string());
            a.coats = Some(2);
            (NormValue::range(3.5, 3.0, 4.2, Confidence::Medium), a)
        }
    }
}

/// § 1.5 Краска: L/m² = слои / rendimento. Rendimento практическое из фичи:
/// интерьерные PT-фичи 10–15 m²/L/слой, центр 12. Впитываемость основания —
/// Risk #1 (меняет rendimento в разы) — пока не знаем, confidence Medium.
pub fn paint_per_unit(coats: Option<u8>) -> (NormValue, NormAssumptions) {
    let mut a = NormAssumptions::default();
    let n = coats.unwrap_or(DEFAULT_PAINT_COATS);
    a.coats = Some(n);
    let n = n as f64;
    (
        NormValue::range(n / 12.0, n / 15.0, n / 10.0, Confidence::Medium),
        a,
    )
}

/// § 1.5 Грунт: 1 слой, rendimento ~10 [8–12] m²/L → 0.10 [0.083–0.125] L/m².
pub fn primer_per_unit() -> (NormValue, NormAssumptions) {
    let a = NormAssumptions {
        coats: Some(1),
        ..Default::default()
    };
    (
        NormValue::range(1.0 / 10.0, 1.0 / 12.0, 1.0 / 8.0, Confidence::Medium),
        a,
    )
}

/// § 1.4 A: Наливной пол (autonivelante): kg/m² = consumo(kg/m²/мм) × толщина(мм).
/// Consumo по брендам: 1.6 [1.5–1.74] (медиана пяти verbatim-точек, verify-правка).
/// Толщина = f(ровность основания) — Risk #1: при Unknown → Unvalidated.
pub fn floor_leveler_per_unit(
    thickness_mm: Option<f64>,
    substrate: Option<SubstrateFlatness>,
) -> (NormValue, NormAssumptions) {
    let mut a = NormAssumptions::default();
    let t = thickness_mm.unwrap_or(DEFAULT_LEVELER_THICKNESS_MM);
    a.layer_thickness_mm = Some(t);
    a.substrate_flatness = Some(substrate.unwrap_or(SubstrateFlatness::Unknown));
    let consumo = NormValue::range(1.6, 1.5, 1.74, Confidence::Medium);
    let mut per_unit = consumo.scale(t);
    if thickness_mm.is_none() || matches!(a.substrate_flatness, Some(SubstrateFlatness::Unknown)) {
        // Толщина не замерена → честный флаг калибровки (гл.07 §3.1:
        // «два одинаковых помещения могут требовать 5 и 45 мм»).
        per_unit.confidence = Confidence::Unvalidated;
        a.free_notes.push(
            "толщина слоя взята дефолтом — замерить перепад лазером/рейкой (Risk #1)".to_string(),
        );
    }
    (per_unit, a)
}

/// § 1.4 B: Балластная стяжка (betonilha): kg/m² = consumo(kg/m²/СМ) × толщина(см).
/// Consumo 20 [20–21]. ДРУГОЙ класс продукта, чем autonivelante (~10× на мм).
pub fn screed_mix_per_unit(thickness_cm: f64) -> (NormValue, NormAssumptions) {
    let a = NormAssumptions {
        layer_thickness_mm: Some(thickness_cm * 10.0),
        ..Default::default()
    };
    let consumo = NormValue::range(20.0, 20.0, 21.0, Confidence::Medium);
    (consumo.scale(thickness_cm), a)
}

/// § 1.6 Плитка: количество = площадь × 1.0 (coverage), отход — отдельным
/// waste_factor по паттерну (norms::tile_waste_factor).
pub fn tile_per_unit() -> NormValue {
    NormValue::point(1.0, Confidence::High)
}

/// § 1.6 Плинтус: длина = периметр − дверные проёмы (геометрия отдаёт длину);
/// расход 1.0 м/м, отход на подрезку углов ~5%.
pub fn baseboard_per_unit() -> NormValue {
    NormValue::point(1.0, Confidence::High)
}

/// Отход для нережущихся/малоотходных материалов (клей/затирка/краска/грунт/
/// гидро/ровнитель): минимальный технологический запас.
pub fn bulk_waste() -> NormValue {
    NormValue::range(0.05, 0.0, 0.10, Confidence::Medium)
}

/// Отход плинтуса (подрезка углов).
pub fn baseboard_waste() -> NormValue {
    NormValue::range(0.05, 0.03, 0.10, Confidence::Medium)
}
