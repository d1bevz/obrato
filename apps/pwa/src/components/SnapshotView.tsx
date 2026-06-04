import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSnapshot } from '../store/snapshots';
import type { SnapshotDoc } from '../store/db';
import { PurchaseListBody } from './PurchaseList';

// Просмотр PurchaseSnapshot (P3): рендер ИЗ frozen_list-blob — снапшот
// самодостаточен (гл.05 §5), пересчёта нет, история иммутабельна.

export function SnapshotView({ snapshotId }: { snapshotId: string }) {
  const navigate = useNavigate();
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
      <PurchaseListBody list={snap.frozenList} skuTitles={snap.skuTitles} />
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
