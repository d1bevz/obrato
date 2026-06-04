//! Геометрия: площади и периметры из прямоугольной комнаты.
//!
//! Ядро отдаёт ЧИСЛА (driving measures), не пиксели и не SVG (D2, гл.05 §8).
//! Площадь гидроизоляции = пол + периметр × заход (upstand) — гл.07 §1.3;
//! она БОЛЬШЕ площади пола, это и была дыра, закрытая 2026-06-04.

use crate::model::{Opening, OpeningKind, Room};

pub fn floor_area_m2(room: &Room) -> f64 {
    room.length_m * room.width_m
}

pub fn ceiling_area_m2(room: &Room) -> f64 {
    room.length_m * room.width_m
}

pub fn perimeter_m(room: &Room) -> f64 {
    2.0 * (room.length_m + room.width_m)
}

fn opening_area(o: &Opening) -> f64 {
    o.width_m * o.height_m
}

/// Площадь стен net: периметр × высота − все проёмы (двери, окна, арки).
pub fn wall_area_m2(room: &Room) -> f64 {
    let gross = perimeter_m(room) * room.height_m;
    let openings: f64 = room.openings.iter().map(opening_area).sum();
    (gross - openings).max(0.0)
}

/// Площадь гидроизоляции = пол + периметр × wet_zone_height (гл.07 §1.3).
/// Периметр мокрой зоны на пилоте = весь периметр комнаты (кастомный контур —
/// deferred, гл.05 §2). Возвращает (площадь, применённый_заход_м, был_ли_дефолт).
pub fn waterproofing_area_m2(room: &Room, default_upstand_m: f64) -> (f64, f64, bool) {
    let (upstand, defaulted) = match room.wet_zone_height_m {
        Some(h) => (h, false),
        None => (default_upstand_m, true),
    };
    let area = floor_area_m2(room) + perimeter_m(room) * upstand;
    (area, upstand, defaulted)
}

/// Длина плинтуса = периметр − ширины ДВЕРНЫХ проёмов (двери и арки);
/// окна плинтус не прерывают (гл.07 §1.6). Вычеты под кухонный гарнитур и
/// встроенные шкафы — знание app-слоя/прораба, ядро их не видит (см.
/// reference.json f5: ведомость проектировщика меньше периметров именно поэтому).
pub fn baseboard_length_m(room: &Room) -> f64 {
    let doors: f64 = room
        .openings
        .iter()
        .filter(|o| matches!(o.kind, OpeningKind::Door | OpeningKind::Passage))
        .map(|o| o.width_m)
        .sum();
    (perimeter_m(room) - doors).max(0.0)
}
