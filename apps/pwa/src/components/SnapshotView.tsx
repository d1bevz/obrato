import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSnapshot } from '../store/snapshots';
import type { SnapshotDoc } from '../store/db';
import { AmigoTip } from './Amigo';
import { PurchaseListBody } from './PurchaseList';

// Просмотр PurchaseSnapshot (P3): рендер ИЗ frozen_list-blob — снапшот
// самодостаточен (гл.05 §5), пересчёта нет, история иммутабельна.

export function SnapshotView({ snapshotId }: { snapshotId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  // Только сразу после freeze: Amigo празднует ключевую точку воронки
  // (§10.2 S5); просмотр истории — без фанфар. history.state переживает
  // reload/back — латчим показ на маунт и стираем state (анти-триггер
  // §10.4: «повтор прочитанной подсказки»).
  const [justFrozen] = useState(() =>
    Boolean((location.state as { justFrozen?: boolean } | null)?.justFrozen),
  );
  useEffect(() => {
    if (justFrozen) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [snap, setSnap] = useState<SnapshotDoc | null | 'loading'>('loading');

  useEffect(() => {
    let gone = false;
    setSnap('loading'); // смена id не должна показывать прошлый снапшот
    getSnapshot(snapshotId).then(
      (s) => !gone && setSnap(s ?? null),
      () => !gone && setSnap(null),
    );
    return () => {
      gone = true;
    };
  }, [snapshotId]);

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

  const when = new Date(snap.createdAt).toLocaleString('ru', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <main>
      {justFrozen && (
        <AmigoTip kind="ok" mood="suc" spark className="screen-only">
          <b>Лист готов</b> — кати в магазин. Вернёшься — запиши факт
          закупки, сверим с расчётом.
        </AmigoTip>
      )}
      <div className="notice screen-only">
        ❄ Снапшот от {when} — заморожен, не пересчитывается. Факт закупки
        сверяется с ним (P4).
      </div>
      <div className="print-header print-only">
        <b>Obrato · лист закупок (снапшот {when})</b> — {snap.projectTitle}
        <br />
        нормы {snap.normSetLabel} · каталог {snap.catalogVersion} · цены —
        ориентир
      </div>
      <PurchaseListBody
        list={snap.frozenList}
        skuTitles={snap.skuTitles}
        skuStores={snap.skuStores}
      />
      <button
        type="button"
        className="btn primary screen-only"
        onClick={() =>
          navigate(`/project/${snap.projectId}/snapshot/${snap.id}/actuals`)
        }
      >
        Записать факт закупки
      </button>
      <button
        type="button"
        className="btn outline screen-only"
        onClick={() => window.print()}
      >
        🖨 Печать / PDF
      </button>
      <div className="roadmap">
        нормы {snap.normSetLabel} · {snap.engineVersion} · каталог{' '}
        {snap.catalogVersion}
      </div>
    </main>
  );
}
