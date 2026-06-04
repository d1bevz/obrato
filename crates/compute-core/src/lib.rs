//! Obrato compute-core (Rust) — детерминированный движок прораба.
//!
//! Поток: модель ввода (Room + работы) → нормы (формулы гл.07, диапазон +
//! confidence) → оценки материалов (гл.05 §8). Округление до фасовок и лист
//! закупок по этапам — слайс 1; WASM-граница — слайс 3 (гл.11 §11.2).
//!
//! Архитектурные инварианты:
//! - чистый модуль: ноль зависимостей сверх std, ни IO, ни UI, ни SVG (D2);
//! - выход — ДИАПАЗОН + confidence, не точка (D7, Risk #1 как фича);
//! - источник истины формул — гл.07; контракта — гл.05 §8 (не TS-прототип).
//!
//! Приёмка M0: golden-тесты квартиры flatplan №1001_527
//! (docs/reference/flatplan-1001_527/) — tests/flatplan_golden.rs.

pub mod engine;
pub mod formulas;
pub mod geometry;
pub mod materials;
pub mod model;
pub mod norms;

pub use engine::{MaterialEstimate, compose_quantity, estimates_for_project, estimates_for_room};
pub use materials::{DrivingMeasure, MaterialKind, Stage, Unit};
pub use model::{
    FloorFinish, FloorWork, LayoutPattern, Opening, OpeningKind, Project, Room, RoomType,
    WallsWork, Works,
};
pub use norms::{Confidence, NormAssumptions, NormValue};
