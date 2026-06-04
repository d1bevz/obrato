import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FloorFinish, Opening, OpeningKind, RoomType } from 'compute-wasm';
import type { ProjectDoc } from '../store/db';
import { deleteRoom, upsertRoom } from '../store/projectStore';
import { uuidv7 } from '../store/uuid';
import { OPENING_DEFAULTS, ROOM_TEMPLATES } from '../templates/roomTemplates';
import type { ElectricPoints, Room, Works } from '../types';
import {
  OPENING_KIND_LABEL,
  ROOM_TYPE_ICON,
  ROOM_TYPE_LABEL,
} from '../types';

// S3 · RoomEditor (гл.08 §3, Open Q4): тип → шаблон предзаполнил → Д×Ш×В,
// wet + заход гидры, 4 галочки, проёмы. Медиана ввода на типовую комнату —
// «геометрия + подтверждение», не заполнение анкеты (П3).
// Norm-входы формул (зуб, шов, формат плитки…) сознательно ВНЕ формы —
// seed-дефолты NormAssumptions, уточняются калибровкой (Risk #1), не полями.

const ROOM_TYPES: RoomType[] = [
  'bathroom',
  'kitchen',
  'bedroom',
  'living',
  'hallway',
  'other',
];

const FLOOR_FINISHES: { value: FloorFinish; label: string }[] = [
  { value: 'tile', label: 'плитка' },
  { value: 'laminate', label: 'ламинат' },
  { value: 'vinyl', label: 'винил' },
];

/** Проём в черновике — размеры строками: парсинг на каждое нажатие съедал
 * бы десятичную точку и не давал очистить поле (находка ревью P2). */
interface OpeningDraft {
  kind: OpeningKind;
  widthM: string;
  heightM: string;
}

/** Черновик формы: размеры — строками (мобильный ввод), работы — структурой. */
interface Draft {
  type: RoomType;
  name: string;
  lengthM: string;
  widthM: string;
  heightM: string;
  wet: boolean;
  wetZoneHeightM: string;
  works: Works;
  openings: OpeningDraft[];
}

function openingDraft(kind: OpeningKind, w: number, h: number): OpeningDraft {
  return { kind, widthM: String(w), heightM: String(h) };
}

function draftFromTemplate(type: RoomType): Draft {
  const t = ROOM_TEMPLATES[type];
  const d = OPENING_DEFAULTS.door;
  return {
    type,
    name: t.defaultName,
    lengthM: '',
    widthM: '',
    heightM: '2.70',
    wet: t.wet,
    wetZoneHeightM: t.wetZoneHeightM.toFixed(1),
    works: structuredClone(t.works),
    openings: [openingDraft('door', d.widthM, d.heightM)],
  };
}

function draftFromRoom(r: Room): Draft {
  return {
    type: r.type,
    name: r.name,
    lengthM: String(r.lengthM),
    widthM: String(r.widthM),
    heightM: String(r.heightM),
    wet: r.wet,
    wetZoneHeightM: (r.wetZoneHeightM ?? 2.0).toFixed(1),
    works: structuredClone(r.works),
    openings: r.openings.map((o) => openingDraft(o.kind, o.widthM, o.heightM)),
  };
}

function num(s: string): number {
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <span className="stepper">
      <button
        type="button"
        aria-label="меньше"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="stepper-val">{value}</span>
      <button
        type="button"
        aria-label="больше"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </span>
  );
}

/** Строка-галочка: label оборачивает ТОЛЬКО чекбокс+титул — контролы справа
 * вне label, иначе тап по степперу/сегменту тогглил бы саму галочку. */
function SwitchRow({
  checked,
  onChange,
  title,
  sub,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="switch-row">
      <label className="switch-label grow">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          {title}
          {sub && <span className="form-sub">{sub}</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

function DimField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="dim-field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder ?? '0.00'}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function RoomEditor({
  project,
  roomId,
}: {
  project: ProjectDoc;
  roomId?: string;
}) {
  const navigate = useNavigate();
  const existing = roomId
    ? (project.rooms.find((r) => r.id === roomId) ?? null)
    : null;
  const [draft, setDraft] = useState<Draft>(() =>
    existing ? draftFromRoom(existing) : draftFromTemplate('bedroom'),
  );
  const [touchedName, setTouchedName] = useState(existing != null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const patchWorks = (w: Partial<Works>) =>
    setDraft((d) => ({ ...d, works: { ...d.works, ...w } }));

  /** Применить wet/works шаблона текущего типа (create — автоматически;
   * edit — по явной кнопке, чтобы не затирать правки молча). */
  const applyTemplate = (type: RoomType) => {
    const t = ROOM_TEMPLATES[type];
    setDraft((d) => ({
      ...d,
      type,
      name: touchedName ? d.name : t.defaultName,
      wet: t.wet,
      wetZoneHeightM: t.wetZoneHeightM.toFixed(1),
      works: structuredClone(t.works),
    }));
  };

  /** Смена типа: в create-режиме шаблон предзаполняет работы/wet заново
   * (правка дельты, гл.08 §3.4); введённая геометрия сохраняется.
   * В edit-режиме работы не трогаем — предлагаем кнопкой (рассинхрон
   * wet/works со сменой типа — самый дорогой класс ошибки, гл.08 §3.2). */
  const changeType = (type: RoomType) => {
    if (existing) {
      patch({ type });
      return;
    }
    applyTemplate(type);
  };

  /** edit-режим: тип сменили, а wet/works остались от старого — предложить
   * применить шаблон нового типа. */
  const typeChangedInEdit = existing != null && draft.type !== existing.type;

  const dims = {
    lengthM: num(draft.lengthM),
    widthM: num(draft.widthM),
    heightM: num(draft.heightM),
  };
  const dimsValid =
    dims.lengthM > 0 && dims.widthM > 0 && dims.heightM > 0;
  const wetZone = num(draft.wetZoneHeightM);
  const wetZoneValid = !draft.wet || (wetZone > 0 && wetZone <= dims.heightM);

  const parsedOpenings: Opening[] = draft.openings.map((o) => ({
    kind: o.kind,
    widthM: num(o.widthM),
    heightM: num(o.heightM),
  }));
  const openingsValid = parsedOpenings.every(
    (o) => o.widthM > 0 && o.heightM > 0,
  );

  const preview = useMemo(() => {
    if (!dimsValid) return null;
    const floor = dims.lengthM * dims.widthM;
    const perimeter = 2 * (dims.lengthM + dims.widthM);
    const openingsArea = parsedOpenings.reduce(
      (s, o) => s + (o.widthM > 0 && o.heightM > 0 ? o.widthM * o.heightM : 0),
      0,
    );
    return {
      floor,
      walls: Math.max(0, perimeter * dims.heightM - openingsArea),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimsValid, dims.lengthM, dims.widthM, dims.heightM, draft.openings]);

  const canSave = dimsValid && wetZoneValid && openingsValid && !submitting;

  const save = async () => {
    if (!canSave) return;
    const room: Room = {
      id: existing?.id ?? uuidv7(),
      name: draft.name.trim() || ROOM_TEMPLATES[draft.type].defaultName,
      type: draft.type,
      lengthM: dims.lengthM,
      widthM: dims.widthM,
      heightM: dims.heightM,
      wet: draft.wet,
      ...(draft.wet ? { wetZoneHeightM: wetZone } : {}),
      openings: parsedOpenings,
      works: draft.works,
    };
    setSubmitting(true);
    try {
      await upsertRoom(project.id, room);
      navigate(`/project/${project.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!existing || submitting) return;
    if (!window.confirm(`Удалить комнату «${existing.name}»?`)) return;
    setSubmitting(true);
    try {
      await deleteRoom(project.id, existing.id);
      navigate(`/project/${project.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  const ep = draft.works.electricPoints;

  return (
    <>
      <main>
        {/* Тип + название */}
        <div className="card form-card">
          <div className="chip-row">
            {ROOM_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${draft.type === t ? 'active' : ''}`}
                onClick={() => changeType(t)}
              >
                {ROOM_TYPE_ICON[t]} {ROOM_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Название</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => {
                setTouchedName(true);
                patch({ name: e.target.value });
              }}
            />
          </label>
          {typeChangedInEdit && (
            <button
              type="button"
              className="chip"
              onClick={() => applyTemplate(draft.type)}
            >
              применить шаблон «{ROOM_TYPE_LABEL[draft.type]}» (мокрая зона и
              работы)
            </button>
          )}
        </div>

        {/* Геометрия */}
        <div className="card form-card">
          <h3 className="form-title">Размеры, м</h3>
          <div className="dim-row">
            <DimField
              label="Длина"
              value={draft.lengthM}
              onChange={(v) => patch({ lengthM: v })}
            />
            <DimField
              label="Ширина"
              value={draft.widthM}
              onChange={(v) => patch({ widthM: v })}
            />
            <DimField
              label="Высота"
              value={draft.heightM}
              onChange={(v) => patch({ heightM: v })}
            />
          </div>
          {preview && (
            <div className="form-hint">
              пол {preview.floor.toFixed(1)} м² · стены ≈{' '}
              {preview.walls.toFixed(1)} м² (минус проёмы)
            </div>
          )}
        </div>

        {/* Мокрая зона — явный вход прораба, не вывод из типа (гл.05 §2) */}
        <div className="card form-card">
          <SwitchRow
            checked={draft.wet}
            onChange={(wet) => patch({ wet })}
            title="💧 Мокрая зона"
            sub="гидроизоляция + плитка на стены вместо краски"
          />
          {draft.wet && (
            <label className="field">
              <span>Заход гидроизоляции на стены, м</span>
              <input
                type="text"
                inputMode="decimal"
                value={draft.wetZoneHeightM}
                onChange={(e) => patch({ wetZoneHeightM: e.target.value })}
              />
              {!wetZoneValid && (
                <span className="field-error">
                  {dimsValid
                    ? `от 0 до высоты комнаты (${draft.heightM} м)`
                    : 'сначала укажи высоту комнаты'}
                </span>
              )}
            </label>
          )}
        </div>

        {/* Состав работ — 4 галочки (гл.08 §3.2) */}
        <div className="card form-card">
          <h3 className="form-title">Состав работ</h3>

          {/* finish='none' (шаблон other) семантически = «галочка снята»:
              ядро не порождает материалов пола (находка ревью P2). */}
          <SwitchRow
            checked={
              draft.works.floor != null && draft.works.floor.finish !== 'none'
            }
            onChange={(on) => {
              const tFinish = ROOM_TEMPLATES[draft.type].works.floor?.finish;
              patchWorks({
                floor: on
                  ? { finish: tFinish && tFinish !== 'none' ? tFinish : 'tile' }
                  : undefined,
              });
            }}
            title="Пол"
          >
            {draft.works.floor && draft.works.floor.finish !== 'none' && (
              <span className="seg-row">
                {FLOOR_FINISHES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={`seg ${draft.works.floor?.finish === f.value ? 'active' : ''}`}
                    onClick={() => patchWorks({ floor: { finish: f.value } })}
                  >
                    {f.label}
                  </button>
                ))}
              </span>
            )}
          </SwitchRow>

          <SwitchRow
            checked={draft.works.walls != null}
            onChange={(on) =>
              patchWorks({
                walls: on ? (draft.wet ? {} : { paintCoats: 2 }) : undefined,
              })
            }
            title="Стены"
          >
            {draft.works.walls &&
              (draft.wet ? (
                <span className="badge wet">плитка (мокрая зона)</span>
              ) : (
                <span className="count-row">
                  слоёв
                  <Stepper
                    value={draft.works.walls.paintCoats ?? 2}
                    min={1}
                    max={4}
                    onChange={(v) => patchWorks({ walls: { paintCoats: v } })}
                  />
                </span>
              ))}
          </SwitchRow>

          <SwitchRow
            checked={draft.works.ceiling != null}
            onChange={(on) =>
              patchWorks({ ceiling: on ? { paintCoats: 2 } : undefined })
            }
            title="Потолок"
          >
            {draft.works.ceiling && (
              <span className="count-row">
                слоёв
                <Stepper
                  value={draft.works.ceiling.paintCoats ?? 2}
                  min={1}
                  max={4}
                  onChange={(v) => patchWorks({ ceiling: { paintCoats: v } })}
                />
              </span>
            )}
          </SwitchRow>

          <SwitchRow
            checked={ep != null}
            onChange={(on) =>
              patchWorks({
                electricPoints: on
                  ? (ROOM_TEMPLATES[draft.type].works.electricPoints ?? {
                      sockets: 2,
                      switches: 1,
                      lights: 1,
                    })
                  : undefined,
              })
            }
            title="Электрика"
            sub="точки по шаблону, без трасс"
          />
          {ep && (
            <div className="electric-grid">
              {(
                [
                  ['sockets', 'розетки'],
                  ['switches', 'выключатели'],
                  ['lights', 'свет'],
                ] as [keyof ElectricPoints, string][]
              ).map(([key, label]) => (
                <span key={key} className="count-row">
                  {label}
                  <Stepper
                    value={ep[key]}
                    onChange={(v) =>
                      patchWorks({ electricPoints: { ...ep, [key]: v } })
                    }
                  />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Проёмы — вычитаются из стен; двери прерывают плинтус (гл.07 §1.6) */}
        <div className="card form-card">
          <h3 className="form-title">Проёмы</h3>
          {draft.openings.map((o, i) => {
            const bad =
              !(num(o.widthM) > 0) || !(num(o.heightM) > 0) ? ' invalid' : '';
            return (
              <div key={i} className="opening-row">
                <select
                  value={o.kind}
                  aria-label="вид проёма"
                  onChange={(e) => {
                    const kind = e.target.value as OpeningKind;
                    patch({
                      openings: draft.openings.map((x, j) =>
                        j === i ? { ...x, kind } : x,
                      ),
                    });
                  }}
                >
                  {(['door', 'window', 'passage'] as OpeningKind[]).map((k) => (
                    <option key={k} value={k}>
                      {OPENING_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="ширина, м"
                  className={bad ? 'invalid' : undefined}
                  value={o.widthM}
                  onChange={(e) =>
                    patch({
                      openings: draft.openings.map((x, j) =>
                        j === i ? { ...x, widthM: e.target.value } : x,
                      ),
                    })
                  }
                />
                <span className="x">×</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="высота, м"
                  className={bad ? 'invalid' : undefined}
                  value={o.heightM}
                  onChange={(e) =>
                    patch({
                      openings: draft.openings.map((x, j) =>
                        j === i ? { ...x, heightM: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="удалить проём"
                  onClick={() =>
                    patch({
                      openings: draft.openings.filter((_, j) => j !== i),
                    })
                  }
                >
                  ✕
                </button>
              </div>
            );
          })}
          <div className="chip-row">
            {(['door', 'window', 'passage'] as OpeningKind[]).map((k) => (
              <button
                key={k}
                type="button"
                className="chip"
                onClick={() =>
                  patch({
                    openings: [
                      ...draft.openings,
                      openingDraft(
                        k,
                        OPENING_DEFAULTS[k].widthM,
                        OPENING_DEFAULTS[k].heightM,
                      ),
                    ],
                  })
                }
              >
                + {OPENING_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        {existing && (
          <button type="button" className="btn danger-link" onClick={remove}>
            Удалить комнату
          </button>
        )}
        {saveError && <div className="card error">Не сохранилось: {saveError}</div>}
      </main>

      <div className="cta">
        <button className="btn primary" disabled={!canSave} onClick={save}>
          {submitting
            ? 'Сохраняю…'
            : existing
              ? 'Сохранить'
              : 'Добавить комнату'}
        </button>
        {!dimsValid ? (
          <div className="hint">введи размеры Д × Ш × В в метрах</div>
        ) : !openingsValid ? (
          <div className="hint">у проёмов должны быть ширина и высота</div>
        ) : null}
      </div>
    </>
  );
}
