//! Модель ввода ядра: Project → Room → состав работ.
//!
//! Источник истины — гл.05 §2 (Room/WorkSelection/Opening) и §8 (контракт ядра).
//! Ядро получает ДАННЫЕ и отдаёт ДАННЫЕ (D2) — ни UI, ни SVG, ни IO.
//! Комнаты на пилоте прямоугольные; непрямоугольная геометрия — deferred (гл.05 §11).

/// Тип помещения — драйвит шаблоны предзаполнения на app-слое.
/// Ядро использует его только как метаданные (в ядре нет «магии по типу»).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoomType {
    Bathroom,
    Kitchen,
    Bedroom,
    Living,
    Hallway,
    Other,
}

/// Вид проёма. Для площади стен вычитаются все; для плинтуса — только дверные
/// (дверь/passage), окна плинтус не прерывают (гл.07 §1.6).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpeningKind {
    Door,
    Window,
    /// Проём без полотна (арка/портал) — для плинтуса считается как дверной.
    Passage,
}

/// Проём (дверь/окно/арка) — вычитается из площади стен.
#[derive(Debug, Clone, Copy)]
pub struct Opening {
    pub kind: OpeningKind,
    pub width_m: f64,
    pub height_m: f64,
}

/// Финиш пола (вариант WorkSelection::floor, гл.05 §2).
/// Ламинат/винил сами по себе — вне 10 материалов каталога (закупаются
/// отдельно); ядро для них считает подготовку (ровнитель) и плинтус.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FloorFinish {
    Tile,
    Laminate,
    Vinyl,
    None,
}

/// Паттерн раскладки плитки — драйвит waste% (гл.07 §1.7).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayoutPattern {
    Straight,
    Brick,
    Diagonal,
    Herringbone,
}

/// Работы по полу.
#[derive(Debug, Clone, Copy)]
pub struct FloorWork {
    pub finish: FloorFinish,
    /// Паттерн для плитки; None → straight (дефолт пилота, гл.08 §3.2).
    pub tile_pattern: Option<LayoutPattern>,
}

/// Работы по стенам: мокрая комната → плитка, сухая → краска (гл.08 §3.2).
/// Выбор ветки делает ядро по `Room.wet`; здесь — параметры.
#[derive(Debug, Clone, Copy)]
pub struct WallsWork {
    /// Число слоёв краски (сухая ветка). Дефолт 2 (гл.07 §1.5).
    pub paint_coats: Option<u8>,
    /// Паттерн раскладки настенной плитки (мокрая ветка); None → straight.
    pub tile_pattern: Option<LayoutPattern>,
}

/// Работы по потолку.
#[derive(Debug, Clone, Copy)]
pub struct CeilingWork {
    pub paint_coats: Option<u8>,
}

/// Состав работ комнаты — 4 галочки (гл.08 §3.2). Электрика (точки) на M0
/// не порождает материалов из 10 видов каталога — её количества живут на
/// app-слое (шаблоны точек), см. гл.06 «вне пилотных 5 материалов».
#[derive(Debug, Clone, Copy, Default)]
pub struct Works {
    pub floor: Option<FloorWork>,
    pub walls: Option<WallsWork>,
    pub ceiling: Option<CeilingWork>,
}

/// Комната — единственный человекозаполняемый вход (гл.05 §2).
#[derive(Debug, Clone)]
pub struct Room {
    pub id: String,
    pub name: String,
    pub room_type: RoomType,
    pub length_m: f64,
    pub width_m: f64,
    pub height_m: f64,
    /// Мокрая зона — ЯВНЫЙ вход прораба, не вывод из типа (гл.05 §2).
    pub wet: bool,
    /// Высота захода гидроизоляции на стены (upstand), м. Релевантно при wet.
    /// None → дефолт ядра (см. norms::DEFAULT_UPSTAND_M) с confidence=Unvalidated —
    /// это Risk #1-вход (гл.07 §3.4).
    pub wet_zone_height_m: Option<f64>,
    pub openings: Vec<Opening>,
    pub works: Works,
}

/// Проект = набор комнат (плоский список, RoomGroup — deferred).
#[derive(Debug, Clone)]
pub struct Project {
    pub id: String,
    pub title: String,
    pub rooms: Vec<Room>,
}
