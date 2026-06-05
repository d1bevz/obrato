// План объекта (D12a, обкатка v1 #2): первоисточник как картинка — страницы
// дизайн-проекта из бандла (демо) или фото/скан пользователя (Blob в
// IndexedDB, офлайн работает). Приложение картинку НЕ интерпретирует —
// это референс для глаза; данные расчёта по-прежнему вводятся руками.

import { useEffect, useState } from 'react';
import type { PlanDoc, ProjectDoc } from '../store/db';
import { deletePlan, getPlan, savePlan } from '../store/plans';

/** Даунскейл фото: телефонные 8–12 МБ JPEG не тащим в IndexedDB целиком.
 * Потолок щадящий: план — штриховой чертёж, под цифрами размеров нужно
 * разрешение (находка ревью итерации 2). */
const MAX_SIDE = 2560;

function toBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, mime, quality));
}

async function normalizeImage(
  file: File,
): Promise<{ blob: Blob; mime: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale >= 1 && file.size < 1.5 * 1024 * 1024) {
      bmp.close();
      return { blob: file, mime: file.type };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    // webp на тонких линиях чертежа заметно чище jpeg при том же весе;
    // движок без webp вернёт из toBlob другой type — тогда jpeg 0.92
    const webp = await toBlob(canvas, 'image/webp', 0.9);
    if (webp && webp.type === 'image/webp') {
      return { blob: webp, mime: 'image/webp' };
    }
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.92);
    if (!jpeg) throw new Error('canvas.toBlob: null');
    return { blob: jpeg, mime: 'image/jpeg' };
  } catch {
    // экзотический формат/нет ImageBitmap — храним как есть, лучше чем терять
    return { blob: file, mime: file.type };
  }
}

function assetLabel(path: string): string {
  if (path.includes('layout')) return 'планировка';
  if (path.includes('measure')) return 'обмерный план';
  return 'план';
}

export function ObjectPlan({ project }: { project: ProjectDoc }) {
  const [plan, setPlan] = useState<PlanDoc | null | 'loading'>('loading');
  const [userUrl, setUserUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    setPlan('loading');
    getPlan(project.id).then(
      (p) => !gone && setPlan(p ?? null),
      () => !gone && setPlan(null),
    );
    return () => {
      gone = true;
    };
  }, [project.id]);

  // objectURL живёт строго при доке: revoke на смену/анмаунт.
  useEffect(() => {
    if (plan === 'loading' || plan == null) {
      setUserUrl(null);
      return;
    }
    const u = URL.createObjectURL(plan.blob);
    setUserUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [plan]);

  // Открытый лайтбокс: Escape закрывает, фон не скроллится (находка ревью).
  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [lightbox]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // повторный выбор того же файла снова триггерит change
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, mime } = await normalizeImage(file);
      const doc: PlanDoc = {
        projectId: project.id,
        orgId: project.orgId,
        blob,
        mime,
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
      };
      await savePlan(doc); // idb-сначала, потом стейт (инвариант стора)
      setPlan(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deletePlan(project.id);
      setPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const sources: { src: string; label: string }[] = [
    ...(userUrl ? [{ src: userUrl, label: 'мой план' }] : []),
    ...(project.planAssets ?? []).map((p) => ({
      src: import.meta.env.BASE_URL + p,
      label: assetLabel(p),
    })),
  ];

  return (
    <>
      <div className="card plan-card">
        <div className="plan-head">
          <span className="plan-title">План объекта</span>
          {userUrl && (
            <button
              type="button"
              className="chip"
              disabled={busy}
              onClick={removeUser}
            >
              убрать мой план
            </button>
          )}
        </div>
        {sources.length > 0 ? (
          <div className="plan-thumbs">
            {sources.map((s) => (
              <button
                key={s.src}
                type="button"
                className="plan-thumb"
                onClick={() => setLightbox(s.src)}
              >
                <img
                  src={s.src}
                  alt={`План: ${s.label}`}
                  loading="lazy"
                  decoding="async"
                />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="plan-empty">
            плана пока нет — сфоткай лист дизайн-проекта или обмерный план
          </div>
        )}
        {error && <div className="field-error">не сохранилось: {error}</div>}
        <label className={busy ? 'btn outline file-btn busy' : 'btn outline file-btn'}>
          {busy
            ? 'Сохраняю…'
            : userUrl
              ? '📷 заменить мой план'
              : '📷 загрузить план (фото/скан)'}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={onFile}
          />
        </label>
      </div>
      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="План объекта"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="План объекта" decoding="async" />
          <div className="lightbox-hint">тап — закрыть · растягивай пальцами</div>
        </div>
      )}
    </>
  );
}
