import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  MoneyRange,
  PurchaseItem,
  PurchaseListView,
  QtyConfidence,
  SkuRejection,
  StageKey,
  UnitKey,
} from 'compute-wasm';
import { CATALOG } from '../catalog/catalog';
import { useEstimates } from '../compute/useEstimates';
import type { ProjectDoc } from '../store/db';
import { createSnapshot } from '../store/snapshots';

// S5 · PurchaseList, P3 (гл.13): лист «в магазин» — выход ЯДРА (Грань A,
// гл.05 §5): упаковки (ceil, «бери до» — гл.08 §4 п.5), integer money,
// группировка по этапам. UX честности — гл.08 §4: headline = expected,
// диапазон рядом; деньги всегда «ориентир»; в строках листа —
// QuantityEstimate.confidence (точность ЧИСЛА), не NormValue.confidence.

export const STAGE_LABEL: Record<StageKey, string> = {
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

const QTY_CONFIDENCE_LABEL: Record<QtyConfidence, string> = {
  exact: 'точно',
  estimated: 'оценка',
  wide: 'широкий диапазон',
};

function fmtQty(v: number): string {
  return v < 10 ? v.toFixed(1) : Math.round(v).toString();
}

/** Деньги — точно в центах: строки на глаз сходятся с subtotal/total
 * (по-строчное округление до целых евро ломало сверку — находка ревью P3). */
function fmtEur(minor: number): string {
  return `${(minor / 100).toFixed(2)} €`;
}

function Money({ m, mark = true }: { m: MoneyRange; mark?: boolean }) {
  return (
    <span className="price">
      ≈ {fmtEur(m.expectedMinorUnits)}
      <span className="price-range">
        {' '}
        ({fmtEur(m.lowMinorUnits)}–{fmtEur(m.highMinorUnits)})
      </span>
      {mark && m.isEstimate && <span className="price-mark"> · ориентир</span>}
    </span>
  );
}

function Row({
  item,
  skuTitles,
}: {
  item: PurchaseItem;
  /** Названия SKU, замороженные при снапшоте; live-лист резолвит из CATALOG. */
  skuTitles?: Record<string, string>;
}) {
  const mat = CATALOG.get(item.materialKey);
  const unit = UNIT_LABEL[item.unit];
  const q = item.quantity;
  // Название SKU: frozen-заголовок → live-каталог ТОЛЬКО если это тот же SKU
  // (после ре-курации default мог смениться — чужой title не показываем).
  const skuTitle =
    (item.skuId && skuTitles?.[item.skuId]) ||
    (item.skuId && mat?.defaultSku?.id === item.skuId
      ? mat.defaultSku.title
      : null);
  return (
    <div className="prow">
      <div className="prow-head">
        <div className="grow">
          <div className="pname">{mat?.nameRu ?? item.materialKey}</div>
          {mat?.namePt && <div className="ppt">{mat.namePt}</div>}
        </div>
        <div className="pqty">
          {item.packs ? (
            <>
              <span className="central">{item.packs.expected} уп.</span>
              <span className="range">
                {fmtQty(q.expected)} {unit} ({fmtQty(q.low)}–{fmtQty(q.high)})
              </span>
            </>
          ) : (
            <>
              <span className="central">
                {fmtQty(q.expected)} {unit}
              </span>
              <span className="range">
                {fmtQty(q.low)}–{fmtQty(q.high)} {unit}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="prow-meta">
        <span className={`badge conf q-${q.confidence}`}>
          {QTY_CONFIDENCE_LABEL[q.confidence]}
        </span>
        {item.packs && item.packs.high > item.packs.expected && (
          <span className="badge buyupto">бери до {item.packs.high} уп.</span>
        )}
        {item.roomCount > 1 && (
          <span className="badge muted">{item.roomCount} комн.</span>
        )}
        <span className="spacer" />
        {item.lineTotal ? (
          <Money m={item.lineTotal} mark={false} />
        ) : (
          <span className="price muted">цена уточняется</span>
        )}
      </div>
      {item.skuId && (
        // Упаковка и цена — ИЗ item (frozen by value, гл.05 §5): снапшот
        // самодостаточен, дрейф живого каталога его не трогает.
        <div className="psku">
          {skuTitle ?? `SKU ${item.skuId}`}
          <span className="psku-pack">
            {item.packSize != null && ` · уп. ${item.packSize} ${unit}`}
            {item.priceMinorUnits != null &&
              ` · ${(item.priceMinorUnits / 100).toFixed(2)} €/уп`}
          </span>
        </div>
      )}
    </div>
  );
}

/** Тело листа — общее для живого расчёта (S5) и снапшота (read-only). */
export function PurchaseListBody({
  list,
  rejections = [],
  skuTitles,
}: {
  list: PurchaseListView;
  rejections?: SkuRejection[];
  skuTitles?: Record<string, string>;
}) {
  if (list.byStage.length === 0) {
    return (
      <div className="card center">
        Лист пуст — в комнатах не отмечено работ, дающих материалы каталога.
      </div>
    );
  }
  return (
    <>
      {rejections.length > 0 && (
        <div className="card error">
          Каталог: позиции отвергнуты ядром (unit-инвариант):{' '}
          {rejections
            .map((r) => `${CATALOG.get(r.materialKey)?.nameRu ?? r.materialKey} (${r.reason})`)
            .join('; ')}
        </div>
      )}
      {list.byStage.map((g) => (
        <section key={g.stage} className="stage">
          <h3 className="stage-title">{STAGE_LABEL[g.stage]}</h3>
          <div className="card stack">
            {g.items.map((item) => (
              <Row
                key={`${g.stage}:${item.materialKey}`}
                item={item}
                skuTitles={skuTitles}
              />
            ))}
            <div className="prow subtotal">
              <span className="muted">итого этап</span>
              <span className="spacer" />
              <Money m={g.subtotal} mark={false} />
            </div>
          </div>
        </section>
      ))}
      <div className="summary">
        <span>итого по материалам каталога</span>
        <Money m={list.total} />
      </div>
    </>
  );
}

export function PurchaseList({ project }: { project: ProjectDoc }) {
  const navigate = useNavigate();
  const { data, error, loading } = useEstimates(project);
  const [freezing, setFreezing] = useState(false);
  const [freezeError, setFreezeError] = useState<string | null>(null);

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

  const empty = data.purchase.byStage.length === 0;

  const freeze = async () => {
    if (freezing) return;
    setFreezing(true);
    try {
      const snap = await createSnapshot(project, data);
      navigate(`/project/${project.id}/snapshot/${snap.id}`);
    } catch (e) {
      setFreezeError(e instanceof Error ? e.message : String(e));
      setFreezing(false);
    }
  };

  return (
    <>
      <main>
        <div className="notice screen-only">
          Seed-нормы ещё не калиброваны объектами — диапазоны честно широкие;
          упаковки округлены вверх, «бери до» — защита от потерянного дня.
        </div>
        {/* Шапка печатной версии (видна только в print) */}
        <div className="print-header print-only">
          <b>Obrato · лист закупок</b> — {project.title}
          <br />
          {new Date().toLocaleDateString('ru')} · нормы {data.normSetLabel} ·
          каталог {data.purchase.catalogVersion} · цены — ориентир
        </div>
        <PurchaseListBody list={data.purchase} rejections={data.rejections} />
        {freezeError && (
          <div className="card error">Снапшот не сохранился: {freezeError}</div>
        )}
        {!empty && (
          <button
            type="button"
            className="btn outline screen-only"
            onClick={() => window.print()}
          >
            🖨 Печать / PDF
          </button>
        )}
        <div className="roadmap">
          нормы {data.normSetLabel} · {data.engineVersion} · каталог{' '}
          {data.purchase.catalogVersion}
          <br />
          ламинат/винил закупаются вне каталога; электрика — точки без
          материалов
        </div>
      </main>
      {!empty && (
        <div className="cta screen-only">
          <button className="btn primary" disabled={freezing} onClick={freeze}>
            {freezing ? 'Замораживаю…' : '❄ Взять в магазин (снапшот)'}
          </button>
          <div className="hint">
            лист зафиксируется как есть — факт закупки сверится с ним (P4)
          </div>
        </div>
      )}
    </>
  );
}
