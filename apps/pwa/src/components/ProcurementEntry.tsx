import { useEffect, useMemo, useState } from 'react';
import type { PurchaseItem, UnitKey } from 'compute-wasm';
import { CATALOG } from '../catalog/catalog';
import {
  latestByLine,
  listActuals,
  recordActual,
  type NewActual,
} from '../store/actuals';
import type {
  ActualDoc,
  ReconciliationReason,
  SnapshotDoc,
} from '../store/db';
import { getSnapshot } from '../store/snapshots';
import { STAGE_LABEL } from './PurchaseList';

// S6 · ProcurementEntry (гл.08 §6, P4): факт закупки по позициям frozen-
// снапшота. Q#9 — три связанных количества (куплено / израсходовано /
// остаток): ввод любых двух — третье вычисляется и подставляется серым;
// все три храним явно. Insert-only: правка = новая запись.
// Сверка (гл.11 §11.4) — на РАСЧЁТНОМ количестве (до округления до фасовки):
// norm_delta = израсходовано − оценка; packaging_delta = куплено −
// израсходовано (артефакт фасовки, норму не трогает).

const UNIT_LABEL: Record<UnitKey, string> = {
  m2: 'м²',
  kg: 'кг',
  l: 'л',
  m: 'м',
  pcs: 'шт',
};

const REASON_LABEL: Record<ReconciliationReason, string> = {
  cutting: 'подрезка (сигнал нормы)',
  waste: 'бой (сигнал нормы)',
  buffer: 'запас прораба (шум)',
  reorder: 'перезаказ (шум)',
  one_off: 'разовый выброс (шум)',
};

function num(s: string): number | null {
  if (s.trim() === '') return null;
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function fmt(v: number | null): string {
  if (v == null) return '—';
  return v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
}

/** Q#9-деривация: что сохранится при текущем вводе. */
function derive(
  item: PurchaseItem,
  packsStr: string,
  purchasedStr: string,
  consumedStr: string,
  leftoverStr: string,
): {
  purchased: number | null;
  consumed: number | null;
  leftover: number | null;
  confidence: 'measured' | 'rough';
} {
  const packs = num(packsStr);
  let purchased = num(purchasedStr);
  let consumed = num(consumedStr);
  let leftover = num(leftoverStr);

  // куплено: рукой > из упаковок > из consumed+leftover
  if (purchased == null && packs != null && item.packSize != null) {
    purchased = packs * item.packSize;
  }
  if (purchased == null && consumed != null && leftover != null) {
    purchased = consumed + leftover;
  }

  // rough = ТОЛЬКО self-confirmation «расход дефолтнут = куплено» (гл.08 §6):
  // расход, выведенный из измеренного рукой остатка, — полноценное измерение.
  const independentSignal = consumed != null || leftover != null;
  if (consumed == null && purchased != null) {
    // типовой путь «в магазине»: расход по умолчанию = куплено (rough)
    consumed = leftover != null ? purchased - leftover : purchased;
  }
  if (leftover == null && purchased != null && consumed != null) {
    leftover = purchased - consumed;
  }

  return {
    purchased,
    consumed,
    leftover,
    confidence: independentSignal ? 'measured' : 'rough',
  };
}

function LineForm({
  snap,
  item,
  prev,
  onSaved,
}: {
  snap: SnapshotDoc;
  item: PurchaseItem;
  /** Последняя запись по позиции: уточнение предзаполняет покупку, чтобы
   * новая (latest) запись не теряла «куплено» из отчёта (insert-only). */
  prev?: ActualDoc;
  onSaved: () => void;
}) {
  const [packs, setPacks] = useState(() =>
    prev?.purchasedPacks != null ? String(prev.purchasedPacks) : '',
  );
  const [purchased, setPurchased] = useState(() =>
    prev?.purchasedQuantity != null && prev.purchasedPacks == null
      ? String(prev.purchasedQuantity)
      : '',
  );
  const [consumed, setConsumed] = useState('');
  const [leftover, setLeftover] = useState('');
  const [price, setPrice] = useState(() =>
    prev?.pricePaidMinorUnits != null
      ? (prev.pricePaidMinorUnits / 100).toFixed(2)
      : '',
  );
  const [reason, setReason] = useState<'' | ReconciliationReason>(
    prev?.reason ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unit = UNIT_LABEL[item.unit];
  const d = derive(item, packs, purchased, consumed, leftover);
  // Инвариант Q#9: остаток не может быть отрицательным (израсходовано
  // больше купленного — ошибка ввода, физически невозможный leftover).
  const negativeLeftover = d.leftover != null && d.leftover < -1e-9;
  const canSave =
    (d.purchased != null || d.consumed != null) && !negativeLeftover;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const doc: NewActual = {
        orgId: snap.orgId,
        projectId: snap.projectId,
        snapshotId: snap.id,
        materialKey: item.materialKey,
        stage: item.stage,
        purchasedPacks: num(packs),
        purchasedQuantity: d.purchased,
        consumedQuantity: d.consumed,
        leftoverQuantity: d.leftover,
        pricePaidMinorUnits:
          num(price) != null ? Math.round(num(price)! * 100) : null,
        confidence: d.confidence,
        reason: reason === '' ? null : reason,
        note: null,
      };
      await recordActual(doc);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="actual-form">
      <div className="dim-row">
        <label className="dim-field">
          <span>Куплено, уп.</span>
          <input
            type="text"
            inputMode="numeric"
            value={packs}
            placeholder={item.packs ? String(item.packs.expected) : ''}
            onChange={(e) => setPacks(e.target.value)}
          />
        </label>
        <label className="dim-field">
          <span>Куплено, {unit}</span>
          <input
            type="text"
            inputMode="decimal"
            value={purchased}
            placeholder={d.purchased != null ? fmt(d.purchased) : ''}
            onChange={(e) => setPurchased(e.target.value)}
          />
        </label>
        <label className="dim-field">
          <span>Цена, €</span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
      </div>
      <div className="dim-row">
        <label className="dim-field">
          <span>Израсходовано, {unit}</span>
          <input
            type="text"
            inputMode="decimal"
            value={consumed}
            placeholder={d.consumed != null ? fmt(d.consumed) : ''}
            onChange={(e) => setConsumed(e.target.value)}
          />
        </label>
        <label className="dim-field">
          <span>Остаток, {unit}</span>
          <input
            type="text"
            inputMode="decimal"
            value={leftover}
            placeholder={d.leftover != null ? fmt(d.leftover) : ''}
            onChange={(e) => setLeftover(e.target.value)}
          />
        </label>
        <label className="dim-field">
          <span>Причина откл.</span>
          <select
            value={reason}
            onChange={(e) =>
              setReason(e.target.value as '' | ReconciliationReason)
            }
          >
            <option value="">—</option>
            {(Object.keys(REASON_LABEL) as ReconciliationReason[]).map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {d.confidence === 'rough' && d.consumed != null && (
        <div className="form-hint">
          расход взят «= куплено» (rough) — после работ уточни новой записью,
          rough не сужает диапазон нормы
        </div>
      )}
      {negativeLeftover && (
        <div className="field-error">
          израсходовано больше купленного — остаток вышел отрицательным,
          проверь числа
        </div>
      )}
      {error && <div className="field-error">Не сохранилось: {error}</div>}
      <button
        type="button"
        className="btn primary slim"
        disabled={!canSave || saving}
        onClick={save}
      >
        {saving ? 'Записываю…' : 'Записать факт'}
      </button>
    </div>
  );
}

/** Сверка по позиции (гл.11 §11.4) — на расчётном количестве. */
function Reconciliation({
  item,
  actual,
}: {
  item: PurchaseItem;
  actual: ActualDoc;
}) {
  const unit = UNIT_LABEL[item.unit];
  const q = item.quantity;
  const consumed = actual.consumedQuantity;
  if (consumed == null) {
    return (
      <div className="recon">
        <span className="badge muted">расход не записан</span>
      </div>
    );
  }
  const normDelta = consumed - q.expected;
  const normPct = q.expected > 0 ? (normDelta / q.expected) * 100 : 0;
  const inRange = consumed >= q.low && consumed <= q.high;
  const rough = actual.confidence === 'rough';
  const packagingDelta =
    actual.purchasedQuantity != null
      ? actual.purchasedQuantity - consumed
      : null;
  return (
    <div className="recon">
      {/* self-confirmation guard (гл.08 §6): rough = расход дефолтнут
          «= куплено» — НЕ калибровочный сигнал, in-range не засчитываем. */}
      {rough ? (
        <span className="badge q-estimated">
          rough — расход не измерен, норму не калибрует
        </span>
      ) : (
        <>
          <span className={`badge ${inRange ? 'q-exact' : 'q-wide'}`}>
            {inRange ? 'в диапазоне нормы' : 'вне диапазона'}
          </span>
          <span className="badge">
            norm Δ {normDelta >= 0 ? '+' : ''}
            {fmt(normDelta)} {unit} ({normPct >= 0 ? '+' : ''}
            {normPct.toFixed(0)}%)
          </span>
        </>
      )}
      {packagingDelta != null && packagingDelta > 1e-9 && (
        <span className="badge muted">
          фасовка Δ +{fmt(packagingDelta)} {unit}
        </span>
      )}
      {actual.reason && (
        <span className="badge muted">{REASON_LABEL[actual.reason]}</span>
      )}
    </div>
  );
}

export function ProcurementEntry({ snapshotId }: { snapshotId: string }) {
  const [snap, setSnap] = useState<SnapshotDoc | null | 'loading'>('loading');
  const [actuals, setActuals] = useState<ActualDoc[]>([]);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let gone = false;
    setSnap('loading');
    Promise.all([getSnapshot(snapshotId), listActuals(snapshotId)]).then(
      ([s, a]) => {
        if (gone) return;
        setSnap(s ?? null);
        setActuals(a);
      },
      () => !gone && setSnap(null),
    );
    return () => {
      gone = true;
    };
  }, [snapshotId, reloadKey]);

  const latest = useMemo(() => latestByLine(actuals), [actuals]);

  if (snap === 'loading') {
    return (
      <main>
        <div className="card center">Загружаю…</div>
      </main>
    );
  }
  if (!snap) {
    return (
      <main>
        <div className="card center">Снапшот не найден.</div>
      </main>
    );
  }

  const lines = snap.frozenList.byStage.flatMap((g) => g.items);
  const withFact = lines.filter((i) =>
    latest.has(`${i.stage}:${i.materialKey}`),
  ).length;
  // Калибровочный сигнал — только measured (self-confirmation guard):
  // rough-записи «расход = куплено» в диапазон не засчитываются.
  const inRange = lines.filter((i) => {
    const a = latest.get(`${i.stage}:${i.materialKey}`);
    return (
      a?.confidence === 'measured' &&
      a.consumedQuantity != null &&
      a.consumedQuantity >= i.quantity.low &&
      a.consumedQuantity <= i.quantity.high
    );
  }).length;

  return (
    <main>
      <div className="summary">
        <span>
          факт: {withFact}/{lines.length} позиций · в диапазоне (measured):{' '}
          {inRange}
        </span>
        <span className="muted">
          ❄{' '}
          {new Date(snap.createdAt).toLocaleDateString('ru', {
            day: '2-digit',
            month: '2-digit',
          })}
        </span>
      </div>
      <div className="notice">
        Сверка идёт по расчётному количеству (до фасовок): «купил мешок,
        ушло 18 кг» — не промах нормы. Эти записи — сырьё калибровки норм.
      </div>
      {snap.frozenList.byStage.map((g) => (
        <section key={g.stage} className="stage">
          <h3 className="stage-title">{STAGE_LABEL[g.stage]}</h3>
          <div className="card stack">
            {g.items.map((item) => {
              const key = `${g.stage}:${item.materialKey}`;
              const actual = latest.get(key);
              const mat = CATALOG.get(item.materialKey);
              const unit = UNIT_LABEL[item.unit];
              return (
                <div key={key} className="prow">
                  <div className="prow-head">
                    <div className="grow">
                      <div className="pname">
                        {mat?.nameRu ?? item.materialKey}
                      </div>
                      <div className="ppt">
                        оценка {fmt(item.quantity.expected)} {unit} (
                        {fmt(item.quantity.low)}–{fmt(item.quantity.high)})
                        {item.packs ? ` · ${item.packs.expected} уп.` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="chip"
                      onClick={() =>
                        setOpenLine(openLine === key ? null : key)
                      }
                    >
                      {openLine === key
                        ? 'свернуть'
                        : actual
                          ? 'уточнить'
                          : 'записать факт'}
                    </button>
                  </div>
                  {actual && (
                    <div className="prow-meta facts">
                      <span className="badge muted">
                        куплено {fmt(actual.purchasedQuantity)} {unit}
                      </span>
                      <span className="badge muted">
                        ушло {fmt(actual.consumedQuantity)} {unit}
                      </span>
                      <span className="badge muted">
                        остаток {fmt(actual.leftoverQuantity)} {unit}
                      </span>
                    </div>
                  )}
                  {actual && <Reconciliation item={item} actual={actual} />}
                  {openLine === key && (
                    <LineForm
                      key={`${key}:${actual?.id ?? 'new'}`}
                      snap={snap}
                      item={item}
                      prev={actual}
                      onSaved={() => {
                        setOpenLine(null);
                        setReloadKey((k) => k + 1);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="roadmap">
        insert-only: каждая правка — новая запись; история хранится целиком.
        <br />
        ≥3 наблюдения одного знака вне диапазона → кандидат на сдвиг нормы
        (гл.11 §11.4, калибровка ручная)
      </div>
    </main>
  );
}
