//! Чертёж: naive grid раскладки плитки — Грань A `DrawingGeometry` (гл.09 §2).
//!
//! Ядро отдаёт ГЕОМЕТРИЮ В МЕТРАХ (cols/rows/cells), НЕ пиксели — рендерер
//! маппит метры→px вне ядра (гл.08 §5, D8). Датум пилота — corner (угол
//! 0,0), паттерн — grid; центрирование/датумы и балансировка подрезки —
//! solver фазы 2 (D8, гл.02), это сознательно «черновая раскладка».
//!
//! CutOverride'ы ядро НЕ знает: правки — данные app-слоя поверх recomputed
//! baseline (гл.05 §6, Граница C).

/// Ячейка сетки. `cut=true` — краевая подрезка (ячейка обрезана границей
/// комнаты); полные размеры плитки восстановимы из `DrawingGeometry.tile_*`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GridCell {
    pub col: u32,
    pub row: u32,
    pub x_m: f64,
    pub y_m: f64,
    pub w_m: f64,
    pub h_m: f64,
    pub cut: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DrawingGeometry {
    pub room_length_m: f64,
    pub room_width_m: f64,
    pub tile_w_m: f64,
    pub tile_h_m: f64,
    pub cols: u32,
    pub rows: u32,
    pub cells: Vec<GridCell>,
    pub full_count: u32,
    pub cut_count: u32,
}

/// Минимальный размер плитки, м — защита от вырожденного входа
/// (0.05 м → сетка не взрывается на миллионы ячеек).
pub const MIN_TILE_M: f64 = 0.05;

/// Предохранитель размера сетки (наибольшая разумная комната пилота
/// в самой мелкой плитке укладывается с запасом).
pub const MAX_CELLS: u32 = 20_000;

/// Naive grid: датум corner, паттерн grid, подрезка у дальних краёв.
/// Возвращает None при вырожденном входе (неположительные размеры,
/// слишком мелкая плитка, сетка больше MAX_CELLS).
pub fn floor_grid(
    room_length_m: f64,
    room_width_m: f64,
    tile_w_m: f64,
    tile_h_m: f64,
) -> Option<DrawingGeometry> {
    if !(room_length_m > 0.0 && room_width_m > 0.0) {
        return None;
    }
    if !(tile_w_m >= MIN_TILE_M && tile_h_m >= MIN_TILE_M) {
        return None;
    }

    let cols = (room_length_m / tile_w_m).ceil() as u32;
    let rows = (room_width_m / tile_h_m).ceil() as u32;
    if cols == 0 || rows == 0 || cols.saturating_mul(rows) > MAX_CELLS {
        return None;
    }

    let mut cells = Vec::with_capacity((cols * rows) as usize);
    let mut full_count = 0u32;
    let mut cut_count = 0u32;
    let eps = 1e-9;

    for row in 0..rows {
        for col in 0..cols {
            let x = f64::from(col) * tile_w_m;
            let y = f64::from(row) * tile_h_m;
            let w = (room_length_m - x).min(tile_w_m);
            let h = (room_width_m - y).min(tile_h_m);
            let cut = w + eps < tile_w_m || h + eps < tile_h_m;
            if cut {
                cut_count += 1;
            } else {
                full_count += 1;
            }
            cells.push(GridCell {
                col,
                row,
                x_m: x,
                y_m: y,
                w_m: w,
                h_m: h,
                cut,
            });
        }
    }

    Some(DrawingGeometry {
        room_length_m,
        room_width_m,
        tile_w_m,
        tile_h_m,
        cols,
        rows,
        cells,
        full_count,
        cut_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_fit_has_no_cuts() {
        let g = floor_grid(1.8, 0.9, 0.45, 0.45).unwrap();
        assert_eq!((g.cols, g.rows), (4, 2));
        assert_eq!(g.cut_count, 0);
        assert_eq!(g.full_count, 8);
        assert_eq!(g.cells.len(), 8);
    }

    #[test]
    fn remainder_produces_edge_cuts() {
        // 2.0 / 0.45 = 4.44 → 5 колонок, последняя 0.2 м (подрезка);
        // 1.8 / 0.45 = ровно 4 ряда без подрезки.
        let g = floor_grid(2.0, 1.8, 0.45, 0.45).unwrap();
        assert_eq!((g.cols, g.rows), (5, 4));
        assert_eq!(g.cut_count, 4, "вся правая колонка — подрезка");
        let last = g.cells.iter().find(|c| c.col == 4 && c.row == 0).unwrap();
        assert!(last.cut);
        assert!((last.w_m - 0.2).abs() < 1e-9);
        assert!((last.h_m - 0.45).abs() < 1e-9);
    }

    #[test]
    fn area_of_cells_equals_room_area() {
        let g = floor_grid(2.015, 1.985, 0.45, 0.45).unwrap();
        let area: f64 = g.cells.iter().map(|c| c.w_m * c.h_m).sum();
        assert!((area - 2.015 * 1.985).abs() < 1e-9);
    }

    #[test]
    fn degenerate_inputs_rejected() {
        assert!(floor_grid(0.0, 2.0, 0.45, 0.45).is_none());
        assert!(floor_grid(2.0, -1.0, 0.45, 0.45).is_none());
        assert!(floor_grid(2.0, 2.0, 0.01, 0.45).is_none(), "плитка мельче MIN_TILE_M");
        assert!(
            floor_grid(100.0, 100.0, 0.05, 0.05).is_none(),
            "сетка свыше MAX_CELLS отвергается"
        );
    }
}
