import { useMemo } from 'react';
import type {
  Confidence,
  MaterialEstimate,
  MaterialKey,
  StageKey,
  UnitKey,
} from 'compute-wasm';
import { CATALOG, CATALOG_VERSION } from '../catalog/catalog';
import { useEstimates } from '../compute/useEstimates';
import type { Project } from '../types';

// S5 · PurchaseList, итерация P1 (гл.13): материалы с ДИАПАЗОНАМИ + цены-
// «ориентир» из каталога. UX-правила честности — гл.08 §4: headline =
// central, диапазон рядом, не спрятан; деньги всегда «ориентир»;
// unvalidated подсвечен. Упаковки/суммы по фасовкам — P3 (packaging в ядре).

const STAGE_LABEL: Record<StageKey, string> = {
  demolition: 'Демонтаж',
  'rough-plumbing-electric': 'Черновая сантехника и электрика',
  screed: 'Стяжка и выравнивание пола',
  waterproofing: 'Гидроизоляция мокрых зон',
  tiling: 'Плиточные работы',
  'wall-ceiling-finish': 'Отделка стен и потолков',
  flooring: 'Напольные покрытия',
  final: 'Чистовая',
};

const UNIT_LABEL: Record<UnitKey, string> = {
  m2: 'м²',
  kg: 'кг',
  l: 'л',
  m: 'м',
  pcs: 'шт',
};

// Уровень НОРМЫ (NormValue.confidence) — гл.08 §4: на P1 в листе показываем
// его честно; с P3 строки листа перейдут на QuantityEstimate.confidence.
const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'высокая',
  medium: 'средняя',
  low: 'низкая',
  unvalidated: 'не проверено',
};

const CONFIDENCE_ORDER: Confidence[] = ['unvalidated', 'low', 'medium', 'high'];

function minConfidence(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_ORDER.indexOf(a) <= CONFIDENCE_ORDER.indexOf(b) ? a : b;
}

interface PurchaseRow {
  materialKey: MaterialKey;
  unit: UnitKey;
  lo: number;
  central: number;
  hi: number;
  confidence: Confidence;
  /** Уникальные комнаты (краска даёт 2 оценки на комнату: стены + потолок). */
  rooms: Set<string>;
}

interface StageGroup {
  stage: StageKey;
  rows: PurchaseRow[];
}

/** Свод оценок: этап → материал → сумма диапазонов по комнатам.
 * Границы суммируются почленно (lo+lo, hi+hi) — консервативно;
 * confidence свода = худшее звено. */
function groupByStage(estimates: MaterialEstimate[]): StageGroup[] {
  const stages = new Map<StageKey, Map<MaterialKey, PurchaseRow>>();
  for (const e of estimates) {
    let mats = stages.get(e.stage);
    if (!mats) {
      mats = new Map();
      stages.set(e.stage, mats);
    }
    const row = mats.get(e.materialKey);
    if (!row) {
      mats.set(e.materialKey, {
        materialKey: e.materialKey,
        unit: e.unit,
        lo: e.quantity.lo,
        central: e.quantity.central,
        hi: e.quantity.hi,
        confidence: e.quantity.confidence,
        rooms: new Set([e.roomId]),
      });
    } else {
      row.lo += e.quantity.lo;
      row.central += e.quantity.central;
      row.hi += e.quantity.hi;
      row.confidence = minConfidence(row.confidence, e.quantity.confidence);
      row.rooms.add(e.roomId);
    }
  }
  return [...stages.entries()].map(([stage, mats]) => ({
    stage,
    rows: [...mats.values()],
  }));
}

function fmtQty(v: number): string {
  return v < 10 ? v.toFixed(1) : Math.round(v).toString();
}

function fmtEur(minor: number): string {
  return `${Math.round(minor / 100)} €`;
}

function Row({ row }: { row: PurchaseRow }) {
  const mat = CATALOG.get(row.materialKey);
  const unit = UNIT_LABEL[row.unit];
  const unitPrice = mat?.unitPriceMinor ?? null;
  return (
    <div className="prow">
      <div className="prow-head">
        <div className="grow">
          <div className="pname">{mat?.nameRu ?? row.materialKey}</div>
          {mat?.namePt && <div className="ppt">{mat.namePt}</div>}
        </div>
        <div className="pqty">
          <span className="central">
            {fmtQty(row.central)} {unit}
          </span>
          <span className="range">
            {fmtQty(row.lo)}–{fmtQty(row.hi)} {unit}
          </span>
        </div>
      </div>
      <div className="prow-meta">
        <span className={`badge conf conf-${row.confidence}`}>
          {CONFIDENCE_LABEL[row.confidence]}
        </span>
        {row.rooms.size > 1 && (
          <span className="badge muted">{row.rooms.size} комн.</span>
        )}
        <span className="spacer" />
        {unitPrice != null ? (
          <span className="price">
            ≈ {fmtEur(row.central * unitPrice)}
            <span className="price-range">
              {' '}
              ({fmtEur(row.lo * unitPrice)}–{fmtEur(row.hi * unitPrice)})
            </span>
            <span className="price-mark"> · ориентир</span>
          </span>
        ) : (
          <span className="price muted">цена уточняется</span>
        )}
      </div>
      {mat?.defaultSku && (
        <div className="psku">
          {mat.defaultSku.title}
          <span className="psku-pack">
            {' '}
            · уп. {mat.defaultSku.packSize} {unit}
            {mat.price ? ` · ${(mat.price.amountMinorUnits / 100).toFixed(2)} €/уп` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export function PurchaseList({ project }: { project: Project }) {
  const { data, error, loading } = useEstimates(project);
  const groups = useMemo(
    () => (data ? groupByStage(data.estimates) : []),
    [data],
  );

  if (loading) {
    return (
      <main>
        <div className="card center">Считаем на устройстве…</div>
      </main>
    );
  }
  if (error) {
    return (
      <main>
        <div className="card error">
          Ядро не ответило ({error.kind}): {error.message}
        </div>
      </main>
    );
  }
  if (!data) return null;

  const total = groups
    .flatMap((g) => g.rows)
    .reduce(
      (acc, r) => {
        const up = CATALOG.get(r.materialKey)?.unitPriceMinor;
        if (up == null) return acc;
        return {
          lo: acc.lo + r.lo * up,
          central: acc.central + r.central * up,
          hi: acc.hi + r.hi * up,
        };
      },
      { lo: 0, central: 0, hi: 0 },
    );

  return (
    <main>
      <div className="notice">
        Seed-нормы ещё не калиброваны объектами — диапазоны честно широкие и
        сужаются после первых сверок закупок (P4).
      </div>
      {groups.map((g) => (
        <section key={g.stage} className="stage">
          <h3 className="stage-title">{STAGE_LABEL[g.stage]}</h3>
          <div className="card stack">
            {g.rows.map((r) => (
              <Row key={r.materialKey} row={r} />
            ))}
          </div>
        </section>
      ))}
      <div className="summary">
        <span>итого по материалам каталога</span>
        <span>
          ≈ <b>{fmtEur(total.central)}</b>{' '}
          <span className="muted">
            ({fmtEur(total.lo)}–{fmtEur(total.hi)}) · ориентир
          </span>
        </span>
      </div>
      <div className="roadmap">
        нормы {data.normSetLabel} · {data.engineVersion} · каталог{' '}
        {CATALOG_VERSION}
        <br />
        упаковки и суммы «в магазин» — P3; ламинат/винил закупаются вне
        каталога
      </div>
    </main>
  );
}
