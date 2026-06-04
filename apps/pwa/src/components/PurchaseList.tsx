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
import { CATALOG, skuLink, skusFor } from '../catalog/catalog';
import { useEstimates } from '../compute/useEstimates';
import type { ProjectDoc } from '../store/db';
import { createSnapshot } from '../store/snapshots';

// S5 · PurchaseList, P3 (гл.13): лист «в магазин» — выход ЯДРА (Грань A,
// гл.05 §5): упаковки (ceil, «бери до» — гл.08 §4 п.5), integer money,
// группировка по этапам. UX честности — гл.08 §4: headline = expected,
// диапазон рядом; деньги всегда «ориентир»; в строках листа —
// QuantityEstimate.confidence (точность ЧИСЛА), не NormValue.confidence.
// Обкатка v1 (#3a/#3b): строка ведёт на товар (url из seed, scope-пункт 6
// «ссылка/наличие») и раскрывает альтернативные SKU других магазинов —
// read-only, расчёт не трогают (подмена SKU в листе = фаза 2, гл.05 §10).

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

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Фолбэк, когда у SKU нет товарного url (5/141 в seed) или SKU выпал из
 * бандла после ре-курации: поиск по названию — кликабельно всегда (#3a). */
function shopSearch(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
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
  skuStores,
  withAlternatives = false,
}: {
  item: PurchaseItem;
  /** Названия SKU, замороженные при снапшоте; live-лист резолвит из CATALOG. */
  skuTitles?: Record<string, string>;
  /** Имена магазинов, замороженные при снапшоте (см. SnapshotDoc.skuStores). */
  skuStores?: Record<string, string>;
  /** Альтернативные SKU — только в живом листе; снапшот заморожен как есть. */
  withAlternatives?: boolean;
}) {
  const mat = CATALOG.get(item.materialKey);
  const unit = UNIT_LABEL[item.unit];
  const q = item.quantity;
  // skuTitles переданы = рендерим frozen-снапшот, не живой лист.
  const frozen = skuTitles != null;
  // Название SKU: frozen-заголовок → live-каталог ТОЛЬКО если это тот же SKU
  // (после ре-курации default мог смениться — чужой title не показываем).
  const skuTitle =
    (item.skuId && skuTitles?.[item.skuId]) ||
    (item.skuId && mat?.defaultSku?.id === item.skuId
      ? mat.defaultSku.title
      : null);
  // Магазин — факт листа «куда идти»: в снапшоте ТОЛЬКО frozen-значение
  // (живой каталог после ре-курации может показать другой магазин — находка
  // ревью); старые снапшоты без skuStores честно живут без магазина.
  const link = item.skuId ? skuLink(item.skuId) : null;
  const storeName = frozen
    ? (item.skuId ? skuStores?.[item.skuId] : undefined) ?? null
    : (link?.storeName ?? null);
  // Ссылка строки (#3a) — навигация, не frozen-ценность: товарная страница
  // из live-каталога; url-плейсхолдер (главная/категория, гл.10 §10) или
  // его отсутствие → поиск по названию+магазину.
  const productUrl = link?.isProduct ? link.url : null;
  const href =
    productUrl ??
    (skuTitle
      ? shopSearch(storeName ? `${skuTitle} ${storeName}` : skuTitle)
      : (link?.url ?? null));
  const alts = withAlternatives
    ? skusFor(item.materialKey).filter((a) => a.id !== item.skuId)
    : [];
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
        // Упаковка, цена и магазин — frozen by value (гл.05 §5): снапшот
        // самодостаточен, дрейф живого каталога его не трогает. Live —
        // только сама ссылка (навигация «открыть сейчас»).
        <div className="psku">
          <div className="psku-title">
            {href ? (
              <a
                className="psku-link"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {skuTitle ?? `SKU ${item.skuId}`}
                <span className="screen-only">
                  {productUrl ? ' ↗' : ' · поиск'}
                </span>
              </a>
            ) : (
              (skuTitle ?? `SKU ${item.skuId}`)
            )}
          </div>
          {/* магазин/упаковка/цена — своей строкой, ellipsis их не съедает:
              «куда идти» — суть #3a */}
          <div className="psku-pack">
            {[
              storeName,
              item.packSize != null ? `уп. ${item.packSize} ${unit}` : null,
              item.priceMinorUnits != null
                ? `${(item.priceMinorUnits / 100).toFixed(2)} €/уп`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      )}
      {alts.length > 0 && (
        <details className="alts">
          <summary>
            ещё {alts.length}{' '}
            {plural(alts.length, 'вариант', 'варианта', 'вариантов')} в
            магазинах
          </summary>
          <ul className="alts-list">
            {alts.map((a) => (
              <li key={a.id}>
                {/* url-плейсхолдер (главная/категория) товаром не прикидывается:
                    ссылка идёт в поиск, метка «поиск» — честность #3a */}
                <a
                  href={
                    a.isProduct && a.url
                      ? a.url
                      : shopSearch(`${a.title} ${a.storeName}`)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {a.title}
                </a>
                <span className="alts-meta">
                  {' '}
                  — {a.storeName}
                  {a.priceMinorUnits != null &&
                    ` · ${fmtEur(a.priceMinorUnits)}/уп (${a.packSize} ${
                      UNIT_LABEL[a.packUnit as UnitKey] ?? a.packUnit
                    })`}
                  {!(a.isProduct && a.url) && ' · поиск'}
                </span>
              </li>
            ))}
          </ul>
          <div className="alts-note">
            сравнение и переход в магазин: расчёт листа идёт по дефолтному
            SKU — подмена SKU в листе придёт со следующей фазой
          </div>
        </details>
      )}
    </div>
  );
}

/** Тело листа — общее для живого расчёта (S5) и снапшота (read-only). */
export function PurchaseListBody({
  list,
  rejections = [],
  skuTitles,
  skuStores,
  withAlternatives = false,
}: {
  list: PurchaseListView;
  rejections?: SkuRejection[];
  skuTitles?: Record<string, string>;
  skuStores?: Record<string, string>;
  withAlternatives?: boolean;
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
                skuStores={skuStores}
                withAlternatives={withAlternatives}
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
      // justFrozen — Amigo празднует на снапшоте (§10.2 S5: ключевая
      // точка воронки); state эфемерен — повторный заход тих.
      navigate(`/project/${project.id}/snapshot/${snap.id}`, {
        state: { justFrozen: true },
      });
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
          Покупка — в магазине: ссылка в строке открывает товар, цены тут —
          ориентир; перед выездом заморозь лист, после — запиши факт.
        </div>
        {/* Шапка печатной версии (видна только в print) */}
        <div className="print-header print-only">
          <b>Obrato · лист закупок</b> — {project.title}
          <br />
          {new Date().toLocaleDateString('ru')} · нормы {data.normSetLabel} ·
          каталог {data.purchase.catalogVersion} · цены — ориентир
        </div>
        <PurchaseListBody
          list={data.purchase}
          rejections={data.rejections}
          withAlternatives
        />
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
