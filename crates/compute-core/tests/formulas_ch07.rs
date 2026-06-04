//! Тесты формул против опорных чисел гл.07 («Нормы: методология расчёта»).
//! Каждое опорное число — verbatim из фичи бренда или verify-правки гл.07 §4.

use compute_core::formulas;
use compute_core::norms::{Confidence, NormValue, TileFormat, TrowelProfile};

fn close(actual: f64, expected: f64, tol: f64) -> bool {
    (actual - expected).abs() <= tol
}

// ---- § 1.2 Затирка: ((A+B)/(A×B)) × C × D × k, k=1.6 (Mapei, 40/40 ячеек) ----

#[test]
fn grout_mapei_cell_300x300_c8_d3() {
    // Типовой пол 300×300, толщина 8, шов 3: ((600)/(90000))×8×3×1.6 = 0.256
    let (pu, _) = formulas::grout_per_unit(
        Some(TileFormat {
            a_mm: 300.0,
            b_mm: 300.0,
            thickness_mm: 8.0,
        }),
        Some(3.0),
        1.6,
    );
    assert!(close(pu.central, 0.256, 0.001), "got {}", pu.central);
    assert_eq!(pu.confidence, Confidence::High);
}

#[test]
fn grout_mapei_cell_600x600_c10_d3() {
    // Крупноформат 600×600, толщина 10, шов 3: ((1200)/(360000))×10×3×1.6 = 0.16
    let (pu, _) = formulas::grout_per_unit(
        Some(TileFormat {
            a_mm: 600.0,
            b_mm: 600.0,
            thickness_mm: 10.0,
        }),
        Some(3.0),
        1.6,
    );
    assert!(close(pu.central, 0.16, 0.001), "got {}", pu.central);
}

#[test]
fn grout_small_tile_wide_joint_hits_upper_range() {
    // Мелкая плитка 100×100 при широком шве → до ~2.9 (гл.07 §1.2 диапазон).
    let (pu, _) = formulas::grout_per_unit(
        Some(TileFormat {
            a_mm: 100.0,
            b_mm: 100.0,
            thickness_mm: 8.0,
        }),
        Some(10.0),
        1.6,
    );
    // ((200)/(10000))×8×10×1.6 = 2.56
    assert!(close(pu.central, 2.56, 0.001), "got {}", pu.central);
}

#[test]
fn grout_without_format_is_unvalidated_seed() {
    let (pu, a) = formulas::grout_per_unit(None, None, 1.6);
    assert_eq!(pu.confidence, Confidence::Unvalidated);
    assert!(close(pu.central, 0.3, 1e-9));
    assert!(close(pu.lo, 0.04, 1e-9));
    assert!(close(pu.hi, 2.9, 1e-9));
    assert!(
        !a.free_notes.is_empty(),
        "seed-путь обязан флагать калибровку"
    );
}

// ---- § 1.1 Клей: зуб → слой ≈ ½ зуба → kg/m² ----

#[test]
fn adhesive_notch8_single_is_about_5() {
    // Зуб 8 мм → слой 4 мм → 1.2..1.25 kg/m²/мм → 4.8..5.0 (гл.07: «≈ 5»).
    let (pu, a) = formulas::adhesive_per_unit(Some(8.0), None, false);
    assert!(close(pu.central, 4.9, 0.05), "got {}", pu.central);
    assert!(pu.lo >= 4.8 - 1e-9 && pu.hi <= 5.0 + 1e-9);
    assert_eq!(a.trowel_notch_mm, Some(8.0));
}

#[test]
fn adhesive_double_application_multiplies_1_5() {
    // Colagem dupla ×1.5 (Weber: формат >900 см² / влажная / фасад).
    let (single, _) = formulas::adhesive_per_unit(Some(6.0), None, false);
    let (double, _) = formulas::adhesive_per_unit(Some(6.0), None, true);
    assert!(close(double.central, single.central * 1.5, 1e-9));
}

#[test]
fn adhesive_u_profile_divides_by_3() {
    // Гл.07 §1.1: эфф. толщина ≈ зуб/3 для U-образного зуба (vs зуб/2 square).
    let (square, _) = formulas::adhesive_per_unit(Some(9.0), Some(TrowelProfile::Square), false);
    let (u, a) = formulas::adhesive_per_unit(Some(9.0), Some(TrowelProfile::U), false);
    assert!(close(u.central, square.central * 2.0 / 3.0, 1e-9));
    assert_eq!(a.trowel_profile, Some(TrowelProfile::U));
}

#[test]
fn adhesive_seed_ignores_double_application_but_flags_it() {
    // Множитель ×1.5 — только формульная ветка; seed 3.5 [2–8] не стэкается.
    let (pu, a) = formulas::adhesive_per_unit(None, None, true);
    assert!(close(pu.central, 3.5, 1e-9));
    assert!(
        close(pu.hi, 8.0, 1e-9),
        "seed-потолок гл.07 не должен превышаться"
    );
    assert!(a.free_notes.iter().any(|n| n.contains("двойное")));
}

#[test]
fn grout_default_joint_width_is_unvalidated_with_note() {
    // Ширина шва — Risk #1 (калибр партии): дефолт обязан флагать калибровку.
    let (pu, a) = formulas::grout_per_unit(
        Some(TileFormat {
            a_mm: 300.0,
            b_mm: 300.0,
            thickness_mm: 8.0,
        }),
        None,
        1.6,
    );
    assert_eq!(pu.confidence, Confidence::Unvalidated);
    assert!(a.free_notes.iter().any(|n| n.contains("калибр")));
}

#[test]
fn adhesive_seed_without_notch_is_3_5_range_2_8() {
    let (pu, _) = formulas::adhesive_per_unit(None, None, false);
    assert!(close(pu.central, 3.5, 1e-9));
    assert!(close(pu.lo, 2.0, 1e-9) && close(pu.hi, 8.0, 1e-9));
    assert_eq!(pu.confidence, Confidence::Unvalidated);
}

// ---- § 1.3 Гидроизоляция: 2 kg/m² ≈ 1 мм DFT (Sika verbatim) ----

#[test]
fn waterproofing_dft_2mm_is_4_kg() {
    let (pu, a) = formulas::waterproofing_per_unit(Some(2.0));
    assert!(close(pu.central, 4.0, 1e-9), "got {}", pu.central);
    assert_eq!(a.layer_thickness_mm, Some(2.0));
}

#[test]
fn waterproofing_seed_is_3_5_range_3_to_4_2() {
    let (pu, a) = formulas::waterproofing_per_unit(None);
    assert!(close(pu.central, 3.5, 1e-9));
    assert!(close(pu.lo, 3.0, 1e-9) && close(pu.hi, 4.2, 1e-9));
    assert_eq!(a.coats, Some(2), "минимум 2 слоя (weber.dry 824)");
}

// ---- § 1.5 Краска и грунт ----

#[test]
fn paint_2_coats_rendimento_12_is_0_167() {
    let (pu, a) = formulas::paint_per_unit(None);
    assert!(close(pu.central, 2.0 / 12.0, 1e-9), "got {}", pu.central);
    assert!(close(pu.lo, 2.0 / 15.0, 1e-9) && close(pu.hi, 2.0 / 10.0, 1e-9));
    assert_eq!(a.coats, Some(2));
}

#[test]
fn paint_third_coat_scales_linearly() {
    // +1 слой при тёмном/насыщенном цвете (гл.07 §1.5).
    let (two, _) = formulas::paint_per_unit(Some(2));
    let (three, _) = formulas::paint_per_unit(Some(3));
    assert!(close(three.central, two.central * 1.5, 1e-9));
}

#[test]
fn primer_seed_is_0_10() {
    let (pu, a) = formulas::primer_per_unit();
    assert!(close(pu.central, 0.10, 1e-9));
    assert_eq!(a.coats, Some(1));
}

// ---- § 1.4 Стяжка/наливной: два класса, разные единицы (~10×) ----

#[test]
fn leveler_3mm_is_4_8_kg_per_m2() {
    // autonivelante: 1.6 kg/m²/мм × 3 мм = 4.8 (диапазон 4.5–5.22).
    let (pu, a) = formulas::floor_leveler_per_unit(Some(3.0), None);
    assert!(close(pu.central, 4.8, 1e-9), "got {}", pu.central);
    assert!(close(pu.lo, 4.5, 1e-9) && close(pu.hi, 5.22, 1e-9));
    assert_eq!(a.layer_thickness_mm, Some(3.0));
}

#[test]
fn leveler_unknown_thickness_is_unvalidated() {
    // Толщина = f(ровности основания), не выводится из Д×Ш×В — Risk #1.
    let (pu, a) = formulas::floor_leveler_per_unit(None, None);
    assert_eq!(pu.confidence, Confidence::Unvalidated);
    assert!(!a.free_notes.is_empty());
}

#[test]
fn screed_betonilha_4cm_is_80_kg_per_m2() {
    // betonilha: 20 kg/m²/СМ × 4 см = 80 — ~10× к autonivelante на мм слоя.
    let (pu, _) = formulas::screed_mix_per_unit(4.0);
    assert!(close(pu.central, 80.0, 1e-9), "got {}", pu.central);
    let (leveler, _) = formulas::floor_leveler_per_unit(Some(40.0), None);
    // Тот же слой 40 мм: betonilha 80 vs autonivelante 64 — классы не взаимозаменяемы,
    // но единицы (per-мм vs per-см) драматически расходятся на типовых толщинах.
    assert!(close(leveler.central, 64.0, 1e-9));
}

// ---- Правило композиции диапазонов (гл.05 §8) ----

#[test]
fn compose_does_not_compound_lo_lo() {
    use compute_core::compose_quantity;
    let per_unit = NormValue::range(4.0, 2.0, 8.0, Confidence::Medium);
    let waste = NormValue::range(0.10, 0.05, 0.20, Confidence::Medium);
    let q = compose_quantity(10.0, per_unit, waste);
    // central = 10 × 4 × 1.10 = 44
    assert!(close(q.central, 44.0, 1e-9));
    // lo = 10 × 2 × (1 + waste.CENTRAL 0.10) = 22 — НЕ 10×2×1.05 = 21
    assert!(close(q.lo, 22.0, 1e-9), "lo компаундит waste.lo: {}", q.lo);
    // hi = 10 × 8 × (1 + waste.hi 0.20) = 96
    assert!(close(q.hi, 96.0, 1e-9));
    assert!(q.lo <= q.central && q.central <= q.hi);
}

#[test]
fn compose_confidence_is_weakest_link() {
    use compute_core::compose_quantity;
    let pu = NormValue::range(1.0, 0.9, 1.1, Confidence::High);
    let wf = NormValue::range(0.1, 0.0, 0.2, Confidence::Unvalidated);
    assert_eq!(
        compose_quantity(1.0, pu, wf).confidence,
        Confidence::Unvalidated
    );
}
