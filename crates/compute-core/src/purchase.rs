//! Лист закупок — Грань A (гл.05 §5): ephemeral, derived, recomputable.
//!
//! Вход: оценки движка + каталог-вью (`SkuView` — проекция app-слоя, ядро
//! не знает Store/Price-историю, гл.09 §2). Выход: `PurchaseList` по этапам
//! с упаковками и деньгами-диапазонами.
//!
//! Инварианты (гл.09 §2):
//! - **integer money** — `*_minor_units: i64` (центы), без f64-drift;
//! - **unit-инвариант** — SkuView с `pack_unit ≠ base_unit` без
//!   `coverage_per_pack` ОТВЕРГАЕТСЯ (`SkuRejection`), не mis-round тихо;
//! - **packs.high = «бери до этого»** — ceil каждой границы (гл.05 §5),
//!   округление вверх против потерянного дня;
//! - `PurchaseItem` несёт `QuantityEstimate.confidence` (точность ЧИСЛА),
//!   НЕ `NormValue.confidence` (доверие к норме) — гл.08 §4, два энума.

use crate::engine::{MaterialEstimate, NORM_SET_LABEL};
use crate::materials::{MaterialKind, Stage, Unit};

/// Каталог-вью одной позиции (гл.09 §2 «Вниз»): app резолвит default SKU
/// и текущую цену ДО вызова ядра.
#[derive(Debug, Clone)]
pub struct SkuView {
    pub material: MaterialKind,
    pub sku_id: String,
    /// Размер упаковки в `pack_unit`.
    pub pack_size: f64,
    pub pack_unit: Unit,
    /// Покрытие упаковки в base_unit материала, если `pack_unit` иная
    /// (банка «шт» на N м²). None при совпадении единиц.
    pub coverage_per_pack: Option<f64>,
    /// Цена за упаковку, центы EUR. None → лист без денег по позиции.
    pub price_minor_units: Option<i64>,
}

/// Точность ЧИСЛА в строке листа (гл.05 §5) — не доверие к норме.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QtyConfidence {
    Exact,
    Estimated,
    Wide,
}

/// Количество в листе. Семантика та же, что NormValue (central=expected).
#[derive(Debug, Clone, Copy)]
pub struct QuantityEstimate {
    pub low: f64,
    pub expected: f64,
    pub high: f64,
    pub confidence: QtyConfidence,
}

/// Целые упаковки: ceil(bound / pack). high = «buy up to».
#[derive(Debug, Clone, Copy)]
pub struct PackEstimate {
    pub low: u32,
    pub expected: u32,
    pub high: u32,
}

/// Деньги-диапазон, центы. `is_estimate` всегда true на пилоте (D10) —
/// UI обязан метить «ориентир».
#[derive(Debug, Clone, Copy)]
pub struct MoneyRange {
    pub low_minor_units: i64,
    pub expected_minor_units: i64,
    pub high_minor_units: i64,
    pub is_estimate: bool,
}

impl MoneyRange {
    fn zero() -> Self {
        MoneyRange {
            low_minor_units: 0,
            expected_minor_units: 0,
            high_minor_units: 0,
            is_estimate: true,
        }
    }

    fn add(&mut self, other: &MoneyRange) {
        self.low_minor_units += other.low_minor_units;
        self.expected_minor_units += other.expected_minor_units;
        self.high_minor_units += other.high_minor_units;
    }
}

/// Строка листа (гл.05 §5 PurchaseItem). `sku_id`/`packs`/`line_total`
/// опциональны: позиция без валидного SkuView честно остаётся
/// количеством-без-денег, лист не падает.
#[derive(Debug, Clone)]
pub struct PurchaseItem {
    pub material: MaterialKind,
    pub stage: Stage,
    pub quantity: QuantityEstimate,
    pub unit: Unit,
    pub sku_id: Option<String>,
    /// Resolved размер упаковки В BASE_UNIT (для воспроизводимости).
    pub pack_size: Option<f64>,
    /// Цена за упаковку, центы — by value (frozen_list самодостаточен,
    /// гл.05 §5: рендер снапшота не лезет в живой каталог за ценой).
    pub price_minor_units: Option<i64>,
    pub packs: Option<PackEstimate>,
    pub line_total: Option<MoneyRange>,
    /// Сколько комнат дало вклад (UI-сводка; не входит в контракт гл.05,
    /// добавлено P3 как денормализация для экрана).
    pub room_count: u32,
}

#[derive(Debug, Clone)]
pub struct PurchaseStageGroup {
    pub stage: Stage,
    pub items: Vec<PurchaseItem>,
    pub subtotal: MoneyRange,
}

#[derive(Debug, Clone)]
pub struct PurchaseList {
    pub by_stage: Vec<PurchaseStageGroup>,
    pub total: MoneyRange,
    pub norm_set_label: &'static str,
    pub catalog_version: String,
}

/// Отвергнутый SkuView — нарушение unit-инварианта и т.п. App показывает
/// предупреждение; соответствующая строка идёт без packs/денег.
#[derive(Debug, Clone)]
pub struct SkuRejection {
    pub material: MaterialKind,
    pub sku_id: String,
    pub reason: String,
}

/// Сырое количество → целые упаковки (всегда вверх). Порт packsNeeded
/// TS-прототипа (compute-core/src/packaging/round-to-packages.ts).
pub fn packs_needed(raw_quantity: f64, pack_size: f64) -> u32 {
    debug_assert!(pack_size > 0.0, "packs_needed: pack_size > 0");
    if raw_quantity <= 0.0 {
        return 0;
    }
    (raw_quantity / pack_size).ceil() as u32
}

/// Точность числа по относительной ширине диапазона (документированное
/// правило P3): ≤5% — exact, ≤35% — estimated, шире — wide. Отвечает на
/// вопрос строки листа «насколько точна ЭТА цифра», независимо от того,
/// почему диапазон таков (доверие к норме живёт в NormValue.confidence).
fn qty_confidence(low: f64, expected: f64, high: f64) -> QtyConfidence {
    if expected <= 0.0 {
        return QtyConfidence::Wide;
    }
    let width = (high - low) / expected;
    if width <= 0.05 {
        QtyConfidence::Exact
    } else if width <= 0.35 {
        QtyConfidence::Estimated
    } else {
        QtyConfidence::Wide
    }
}

/// Резолв упаковки в base_unit: совпадающая единица → pack_size, иначе
/// требуется coverage_per_pack (unit-инвариант).
fn resolve_pack(sku: &SkuView, base_unit: Unit) -> Result<f64, String> {
    if sku.pack_unit == base_unit {
        if sku.pack_size > 0.0 {
            Ok(sku.pack_size)
        } else {
            Err(format!("pack_size {} ≤ 0", sku.pack_size))
        }
    } else {
        match sku.coverage_per_pack {
            Some(c) if c > 0.0 => Ok(c),
            Some(c) => Err(format!("coverage_per_pack {c} ≤ 0")),
            None => Err(format!(
                "pack_unit {} ≠ base_unit {} без coverage_per_pack",
                sku.pack_unit.key(),
                base_unit.key()
            )),
        }
    }
}

/// Деньги строки: packs × цена упаковки, целочисленно.
fn line_total(packs: PackEstimate, price_minor: i64) -> MoneyRange {
    MoneyRange {
        low_minor_units: i64::from(packs.low) * price_minor,
        expected_minor_units: i64::from(packs.expected) * price_minor,
        high_minor_units: i64::from(packs.high) * price_minor,
        is_estimate: true,
    }
}

/// Свод оценок в лист: этап → материал → сумма диапазонов по комнатам
/// (границы почленно — консервативно), затем упаковки и деньги по SkuView.
pub fn purchase_list(
    estimates: &[MaterialEstimate],
    catalog: &[SkuView],
    catalog_version: &str,
) -> (PurchaseList, Vec<SkuRejection>) {
    let mut rejections = Vec::new();

    // Свод по (stage, material) с сохранением канонического порядка этапов
    // (estimates уже отсортированы движком).
    struct Acc {
        material: MaterialKind,
        stage: Stage,
        unit: Unit,
        low: f64,
        expected: f64,
        high: f64,
        rooms: Vec<String>,
    }
    let mut accs: Vec<Acc> = Vec::new();
    for e in estimates {
        match accs
            .iter_mut()
            .find(|a| a.stage == e.stage && a.material == e.material)
        {
            Some(a) => {
                a.low += e.quantity.lo;
                a.expected += e.quantity.central;
                a.high += e.quantity.hi;
                if !a.rooms.contains(&e.room_id) {
                    a.rooms.push(e.room_id.clone());
                }
            }
            None => accs.push(Acc {
                material: e.material,
                stage: e.stage,
                unit: e.unit,
                low: e.quantity.lo,
                expected: e.quantity.central,
                high: e.quantity.hi,
                rooms: vec![e.room_id.clone()],
            }),
        }
    }

    let mut by_stage: Vec<PurchaseStageGroup> = Vec::new();
    let mut total = MoneyRange::zero();

    for acc in accs {
        let quantity = QuantityEstimate {
            low: acc.low,
            expected: acc.expected,
            high: acc.high,
            confidence: qty_confidence(acc.low, acc.expected, acc.high),
        };

        let sku = catalog.iter().find(|s| s.material == acc.material);
        let mut item = PurchaseItem {
            material: acc.material,
            stage: acc.stage,
            quantity,
            unit: acc.unit,
            sku_id: None,
            pack_size: None,
            price_minor_units: None,
            packs: None,
            line_total: None,
            room_count: acc.rooms.len() as u32,
        };

        if let Some(sku) = sku {
            match resolve_pack(sku, acc.unit) {
                Ok(pack) => {
                    let packs = PackEstimate {
                        low: packs_needed(acc.low, pack),
                        expected: packs_needed(acc.expected, pack),
                        high: packs_needed(acc.high, pack),
                    };
                    item.sku_id = Some(sku.sku_id.clone());
                    item.pack_size = Some(pack);
                    item.price_minor_units = sku.price_minor_units;
                    item.packs = Some(packs);
                    item.line_total = sku
                        .price_minor_units
                        .map(|price| line_total(packs, price));
                }
                Err(reason) => rejections.push(SkuRejection {
                    material: acc.material,
                    sku_id: sku.sku_id.clone(),
                    reason,
                }),
            }
        }

        if let Some(lt) = &item.line_total {
            total.add(lt);
        }

        // Группа ищется по этапу (не last_mut): контракт «одна группа на
        // этап» держится для ЛЮБОГО порядка входа, не только отсортированного
        // движком (находка ревью P3).
        match by_stage.iter_mut().find(|g| g.stage == acc.stage) {
            Some(g) => {
                if let Some(lt) = &item.line_total {
                    g.subtotal.add(lt);
                }
                g.items.push(item);
            }
            None => {
                let mut subtotal = MoneyRange::zero();
                if let Some(lt) = &item.line_total {
                    subtotal.add(lt);
                }
                by_stage.push(PurchaseStageGroup {
                    stage: acc.stage,
                    items: vec![item],
                    subtotal,
                });
            }
        }
    }

    // Канонический порядок этапов независимо от порядка входа (гл.05 §5).
    by_stage.sort_by_key(|g| g.stage);

    (
        PurchaseList {
            by_stage,
            total,
            norm_set_label: NORM_SET_LABEL,
            catalog_version: catalog_version.to_string(),
        },
        rejections,
    )
}
