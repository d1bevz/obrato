// Доменная модель Obrato compute-core.
// Это центр движка: весь поток — это трансформации над этими типами.
// модель ввода -> нормы -> количества -> упаковки -> лист по этапам.

/** Базовые единицы измерения материалов. */
export type Unit = 'm2' | 'kg' | 'l' | 'm' | 'pcs';

/**
 * Канонический порядок этапов стройки. Драйвит и группировку закупок,
 * и тайминг пингов на дозаказ (см. design.md).
 */
export const STAGES = [
  'demolition', // демонтаж
  'rough-plumbing-electric', // черновая сантехника + электрика
  'screed', // стяжка / выравнивание пола
  'waterproofing', // гидроизоляция мокрых зон
  'tiling', // плиточные работы
  'wall-ceiling-finish', // отделка стен/потолков (краска)
  'flooring', // напольные покрытия
  'final', // чистовая: сантехника, электроустановка, двери, мебель
] as const;
export type Stage = (typeof STAGES)[number];

/** Тип помещения — драйвит шаблоны состава работ и электроточек. */
export type RoomType = 'bathroom' | 'kitchen' | 'bedroom' | 'living' | 'hallway' | 'other';

/** Виды работ (галочки по комнате). Электрика — только позиции точек, без трасс. */
export type WorkKind = 'floor' | 'walls' | 'ceiling' | 'electric-points';

/** Проём (дверь/окно) — вычитается из площади стен. */
export interface Opening {
  widthM: number;
  heightM: number;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  lengthM: number;
  widthM: number;
  heightM: number;
  openings: Opening[];
  works: WorkKind[];
  /** Мокрая зона: гидроизоляция + влагостойкие материалы (плитка вместо краски). */
  wet: boolean;
}

export interface Project {
  id: string;
  title: string;
  rooms: Room[];
}

export type MaterialKind =
  | 'floor-tile'
  | 'wall-tile'
  | 'tile-adhesive'
  | 'grout'
  | 'paint'
  | 'primer'
  | 'screed-mix'
  | 'waterproofing'
  | 'baseboard';

/**
 * Норма = число + ДОПУЩЕНИЯ. Допущения едут в результат, чтобы при сверке с
 * реальной закупкой Давида было видно ГДЕ движок соврал, а не только ЧТО.
 * Это механизм митигации Risk #1 из design.md.
 */
export interface NormAssumptions {
  /** Коэффициент отхода/подрезки: 0.10 = +10%. */
  wasteFactor: number;
  /** Явные допущения: паттерн, зубец шпателя, число слоёв, толщина и т.п. */
  notes: string[];
}

/** Требование по материалу — выход движка норм (ДО округления до упаковок). */
export interface MaterialRequirement {
  material: MaterialKind;
  roomId: string;
  stage: Stage;
  rawQuantity: number;
  unit: Unit;
  assumptions: NormAssumptions;
}

/** Товарная позиция каталога (на пилоте — курируемый вручную каталог Leroy PT + локальные). */
export interface Sku {
  id: string;
  material: MaterialKind;
  title: string;
  /** Сколько базовых единиц материала в одной упаковке. */
  packSize: number;
  packUnit: Unit;
  /** Цена за упаковку, EUR. */
  priceEur: number;
  store: 'leroy-pt' | 'local';
  url?: string;
}

/** Строка листа закупок (агрегирована по этап+материал). */
export interface PurchaseItem {
  sku: Sku;
  stage: Stage;
  rawQuantity: number;
  unit: Unit;
  /** Округлено вверх до целых упаковок. */
  packs: number;
  lineTotalEur: number;
}

export interface PurchaseStageGroup {
  stage: Stage;
  items: PurchaseItem[];
  subtotalEur: number;
}

export interface PurchaseList {
  projectId: string;
  byStage: PurchaseStageGroup[];
  totalEur: number;
}
