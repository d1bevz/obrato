//! Obrato compute-wasm — тонкая WASM-обёртка над compute-core (Граница A).
//!
//! Единственное место с wasm-bindgen/serde/tsify (гл.13 §2): ядро остаётся
//! чистым, TS-типы генерятся из dto.rs (D3/D4). Никакой логики норм здесь —
//! только конверсия DTO ↔ core и экспорт.
//!
//! Panic-safety (гл.09 §2): паника Rust в wasm всплывает как JS-исключение —
//! ловит worker-обвязка (apps/pwa/src/compute/worker.ts), не ядро.

pub mod dto;

use wasm_bindgen::prelude::*;

/// Версия движка для футера/diag и cache-version SW (гл.09 ③ ServiceWorker).
#[wasm_bindgen(js_name = engineVersion)]
pub fn engine_version() -> String {
    format!("compute-wasm {}", env!("CARGO_PKG_VERSION"))
}

/// Главный вход Границы A: проект (чистые данные) → оценки материалов
/// с диапазонами (эфемерные, recomputable).
#[wasm_bindgen(js_name = estimatesForProject)]
pub fn estimates_for_project(input: dto::ProjectInput) -> dto::EstimateResponse {
    let project: compute_core::Project = input.into();
    respond(compute_core::estimates_for_project(&project))
}

/// P3: проект + каталог-вью → оценки И лист закупок (упаковки, integer
/// money, unit-инвариант → rejections) одним вызовом.
#[wasm_bindgen(js_name = computeProject)]
pub fn compute_project(
    input: dto::ProjectInput,
    catalog: dto::CatalogInput,
) -> dto::ComputeProjectResponse {
    let project: compute_core::Project = input.into();
    let skus: Vec<compute_core::SkuView> = catalog.skus.into_iter().map(Into::into).collect();
    let estimates = compute_core::estimates_for_project(&project);
    let (list, rejections) =
        compute_core::purchase_list(&estimates, &skus, &catalog.catalog_version);
    dto::ComputeProjectResponse {
        engine_version: engine_version(),
        norm_set_label: compute_core::engine::NORM_SET_LABEL.to_string(),
        estimates: estimates.into_iter().map(Into::into).collect(),
        purchase: list.into(),
        rejections: rejections.into_iter().map(Into::into).collect(),
    }
}

/// Общий хвост: core-оценки → DTO-конверт.
fn respond(estimates: Vec<compute_core::MaterialEstimate>) -> dto::EstimateResponse {
    dto::EstimateResponse {
        engine_version: engine_version(),
        norm_set_label: compute_core::engine::NORM_SET_LABEL.to_string(),
        estimates: estimates.into_iter().map(Into::into).collect(),
    }
}
