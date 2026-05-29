# 05 · Модель данных

Каноническая модель данных Obrato: tenant-ready, offline-first, расширяемая, но **LEAN для пилота N=1** (прораб Давид, прямоугольные комнаты, top-материалы по слоям). Явно разделены **pilot core** (~16 сущностей, строятся сейчас) и **deferred** (спроектированы, материализуются по триггеру). Типы язык-нейтральны и выразимы как Rust serde-структуры и TS-типы.

Легенда: `uuid`, `string`, `float`, `int`, `bool`, `timestamp` (UTC), `enum{...}`, `ref<T>` (FK по uuid), `array<T>`, `T?` (nullable/Option), *(embedded)* = value-object без своей identity/sync, *(deferred)* = в дизайне, не в pilot-schema.

---

### 0. Sync-конверт (`SyncMeta` mixin)

Встраиваемый конверт (`#[serde(flatten)]` / `T & SyncMeta`), не таблица. На каждой персистентной owned-строке. **Ядро (compute-core) его НЕ видит.**

**Поведенческий scope пилота (одна строка, чтобы не строить лишнего):** пилот = single-device, N=1. Реализуется только revision-based optimistic concurrency + LWW-with-warning + tombstone. `lamport`/`device_id` — **reserved-колонки (пишутся, не читаются)** под будущий multi-device; merge-UI и version-vector НЕ строятся сейчас. Поля аддитивны (nullable) — добавление поведения позже = код, не миграция данных.

**Pilot-поля (реплицируются):**

| Поле | Тип | Заметка |
|---|---|---|
| `id` | `uuid` | PK, client-mint UUIDv7 (офлайн, index-locality). Стабилен навсегда — якорь привязки калибровки (D6). |
| `org_id` | `ref<Org>` | Плоский tenant-ключ на КАЖДОЙ owned-строке (D9). Tenant-изоляция = один RLS-предикат. **Глобальные reference-данные (каталог, глоб. NormSet/шаблоны) `org_id` НЕ несут (всегда global).** На write сервер проставляет org_id из membership пушера, а НЕ из тела запроса (trust boundary). |
| `created_at` | `timestamp` | Клиентские часы; аудит. **НЕ авторитетно для merge.** |
| `updated_at` | `timestamp` | Локальная мутация; только UI/аудит. **НЕ авторитетный tiebreaker.** |
| `revision` | `int` | **Server-assigned.** Сервер инкрементит и возвращает; клиент НЕ выдумывает следующий номер. Conflict-токен = присланный `base_revision ≠` текущей серверной revision. |
| `created_by` | `ref<User>?` | Soft-ref (id без жёсткого FK; дружелюбно к офлайн и к D6-атрибуции «чья оценка/факт»). |
| `deleted` | `bool` | Tombstone (soft-delete), синкается. Default false. |
| `deleted_at` | `timestamp?` | Окно для GC. |

**Reserved (колонка есть, поведение позже):** `lamport: int`, `device_id: uuid?`, `schema_version: int`, `updated_by: ref<User>?`.

**Local-only (НЕ реплицируются):**

| Поле | Тип | Заметка |
|---|---|---|
| `sync_status` | `enum{local_dirty, syncing, synced, conflict}` | Отношение локальной строки к серверу, per-device. Драйвит outbox + offline-бейдж. |
| `last_synced_revision` | `int` | Подтверждённая сервером revision = `base_revision` следующей мутации. `revision ≠ last_synced_revision` → непушнутые правки. |

---

### 1. Identity & Tenancy

#### Org *(pilot core)*
Тенант — корень владения; каждый бизнес-объект транзитивно принадлежит ровно одному Org. Pilot = один Org Давида, auto-created офлайн на первом запуске. B2B (billing/plan) отложено.

- `id: uuid` — PK, client-mint.
- `name: string` — имя орг.
- `kind: enum{solo, org}` — pilot=solo. Org-тип позже без миграции.
- `country: enum` — ISO-3166 (PT). Скоупит store-set/валюту/каталог.
- `currency: enum` — ISO-4217 (EUR). Tenant-дефолт отображения; authoritative-валюта едет с каждым `Price`.
- `locale: enum{pt-PT, ru, en}` — дефолт UI/каталога. Pilot=pt-PT.
- `settings: json` — open key/value (override wasteFactor, порядок магазинов).
- `slug: string?` *(reserved)* — будущий B2B-портал.
- + `SyncMeta`

Связи: `Org 1—N Membership`, `1—N Project`. Транзитивный владелец всех owned-строк.

#### User *(pilot core)*
Аутентифицируемая личность, tenant-независимая. Креды — внешний провайдер (не моделируем). Pilot = один User (Давид).

- `id: uuid` — PK, client-mint. Referenced как `created_by` (аудит + D6-атрибуция).
- `display_name: string`
- `email: string?` — unique-when-present, не auth-секрет.
- `phone: string?` — E.164. Прорабы phone-centric — вероятный login/invite-канал.
- `locale: enum{pt-PT, ru, en}?` — override, fallback на `Org.locale`.
- `auth_provider: enum{local, google, apple, otp}?` *(stub)*
- `external_auth_id: string?` — opaque subject id провайдера.
- + `SyncMeta`

Связи: `User 1—N Membership`; `*—* Org` через Membership; soft-ref как `created_by`/`tiler_id`.

#### Membership *(pilot core, минимальный)*
Join User↔Org + дом роли. Делает multi-tenancy реальной; RBAC-движок отложен. Pilot = одна строка role=owner.

- `id: uuid` — surrogate (natural = org_id+user_id).
- `org_id: ref<Org>`
- `user_id: ref<User>` — `(org_id, user_id)` UNIQUE.
- `role: enum{owner, admin, member}` — **ship enum now, enforce later**. Pilot=owner.
- + `SyncMeta`

*(Deferred: `status{active,invited,suspended}`, `invited_by_user_id` — invite-workflow, не на пилоте.)*

#### Device *(deferred)*
PWA-инсталляция, якорь `device_id` для multi-device sync-ordering и tombstone-GC ack. На пилоте `device_id` — локальная константа в IndexedDB, отдельная серверная сущность не материализуется. Вводится вместе с multi-device sync. Bootstrap-инвариант (когда появится): Device-строка майнтится первой в outbox, до любой owned-строки.

---

### 2. Project & Rooms (человекозаполняемый вход ядра)

Единственный человекозаполняемый вход. Всё ниже выводится детерминированно. Геометрия (Room) отделена от состава работ (WorkSelection); шаблон предзаполняет → прораб правит дельту (provenance сохраняется).

#### Project *(pilot core)*
- `id: uuid` — client-mint, стабилен офлайн.
- `org_id: ref<Org>` — D9.
- `owner_user_id: ref<User>` — прораб-создатель (Давид).
- `title: string`
- `address: string?` — логистика дозаказа позже.
- `client_name: string?`
- `status: enum{planning, active, done}` — драйвит estimate-freeze lifecycle (§3).
- `currency: enum{EUR}` — pilot EUR. (Цена-источник живёт в §4; здесь display-дефолт.)
- + `SyncMeta`

Связи: `*—1 Org`, `*—1 User`; `1—N Room` (composition); downstream `1—N MaterialEstimate`/`PurchaseSnapshot`/`ProcurementActual`.

*(Deferred: `groups: array<RoomGroup>` — двухуровневая группировка квартир/этажей; `stage_schedule: array<StageSchedule>` — план дат этапов под ReorderPing. На пилоте — плоский список комнат, без тайминг-движка.)*

#### Room *(pilot core)*
Центральная входная сущность: физика + состав работ. Прямоугольная на пилоте.

- `id: uuid` — client-mint, **СТАБИЛЕН офлайн** — ключ привязки факта при калибровке (D6).
- `project_id: ref<Project>`
- `name: string` — дефолт из type.
- `type: enum RoomType{bathroom, kitchen, bedroom, living, hallway, other}` — драйвит ПРЕДЗАПОЛНЕНИЕ шаблона, не финальную истину по wet.
- `length_m / width_m / height_m: float` — >0, прямоугольная.
- `measurement_source: enum{manual, laser, template_default}` — происхождение размеров (D5/D6). `template_default` = ещё не замерено → авто low-trust сигнал: **комнаты с template_default исключаются из фита** (защита от garbage-геометрии).
- `wet: bool` — ЯВНЫЙ вход прораба (не вывод из type). true → ветка гидроизоляция+плитка. Дефолт из шаблона, перекрывается.
- `openings: array<Opening>` — проёмы, вычитаются из площади стен.
- `works: array<WorkSelection>` — состав работ.
- `site_conditions: JobConditions?` *(embedded)* — site-facts, замеренные раз на комнату (substrate flatness и т.п.). Дефолт для `ProcurementActual.observed_conditions`. Зеркало `NormAssumptions`.
- `applied_template_id: ref<RoomTemplate>?` — какой шаблон предзаполнил (слабая, не cascade).
- `template_version: int?` — версия применённого шаблона (re-apply дельты без затирания правок).
- `notes: string?` — «стена кривая, заложить больше стяжки».
- + `SyncMeta`

**Sync-замечание:** Room мержится как **coarse-grained aggregate** (document-level versioning). Параллельная правка разных полей одной комнаты на двух устройствах = конфликт (LWW-with-warning), НЕ field-level merge. Pilot single-device — не выстрелит; при multi-device промотить `WorkSelection`/`Opening` в first-class строки с собственной identity.

Связи: `*—1 Project`, `*—0..1 RoomTemplate`; embedded `WorkSelection`/`Opening`; downstream `1—N MaterialEstimate`/`LayoutState`.

#### Opening *(embedded)*
- `kind: enum{door, window, passage}` — passage=арка. Влияет на чертёж/нормы (наличник — фаза 2).
- `width_m / height_m: float` — >0.
- `count: int` — default 1.

*(Граница §2/§6: при редактируемой позиции проёма на Canvas (D8) проёму понадобится свой id + offset вдоль стены — defer до пилота.)*

#### WorkSelection *(embedded, tagged union)*
Один вид работ + параметры норм. Discriminated by `kind` (serde tag / TS discriminated union).

- `kind: enum WorkKind{floor, walls, ceiling, electric_points}` — дискриминатор.
- `enabled: bool` — галочка (держим запись и при выкл — provenance шаблона).
- `source: enum{template, user}` — provenance «правки дельты».
- `floor_finish: enum{tile, laminate, vinyl, none}?` — variant floor.
- `tile_pattern: enum{straight, diagonal, brick, herringbone}?` — variant floor/walls с плиткой. D7: сильно влияет на отход.
- `paint_coats: int?` — variant walls/ceiling. Default 2.
- `electric_points: object{sockets, switches, lights}?` — variant electric_points; предзаполняется по RoomType. MVP = позиции без трасс.

Стык: `WorkSelection.kind × material` → `NormRule` (§3).

#### RoomTemplate *(pilot core, курируемая, версионируемая)*
Шаблон предзаполнения по типу комнаты. Каталожная конфиг-сущность (глобальная), версионируется как нормы.

- `id: uuid`
- `room_type: enum RoomType`
- `version: int` — D6-стиль.
- `default_wet: bool` — bathroom=true, перекрывается.
- `default_works: array<WorkSelection>` — source=template, копируется в Room.works.
- `default_openings: array<Opening>`
- `is_active: bool` — мягкое выведение старой версии.
- + `SyncMeta` (**global: `org_id` не несёт**)

---

### 3. Нормы & Калибровка (Risk #1)

Версионируемые нормы (D6), количество-с-диапазоном (D7), estimate↔actual с дня 1 (D6). Автоматический per-tiler fitting-движок (`CalibrationProfile`/`CalibrationOverride`) **из пилота вырезан** — на N=1 калибровка ручная: человек смотрит `Reconciliation.rel_error` → создаёт новую версию NormSet (`basis=manual_override`, `derived_from`=предыдущий). Сырьё (estimate+actual+reconciliation) сохраняется → авто-фит можно сделать ретроспективно.

#### NormSet *(pilot core)*
Версионированный иммутабельный бандл NormRule — единица калибровки. Каждая оценка ПИНИТ свою NormSet. Линейная история через `version`+`derived_from` (без branching-оси `lineage` — её ввести при региональных/B2B-вариантах).

- `id: uuid`
- `org_id: ref<Org>?` — nullable=глобальный seed (общий read-only); tenant-владелец затеняет.
- `version: int` — монотонна per (org, цепь derived_from).
- `label: string` — «global-seed-v1», «david-bathroom-v3».
- `basis: enum{expert_seed, manual_override, fitted}` — как выведены числа (драйвит trust-UI).
- `region: enum` — pt; future-proof.
- `status: enum{active, superseded, archived}` — один active per цепь.
- `derived_from_id: ref<NormSet>?` — self-ref: из чего форкнут/калиброван. Audit-цепь до seed.
- `notes: string?` — что изменилось vs parent.
- + `SyncMeta` — **insert-only класс** (см. Sync-стратегию): create-once, любой upsert с тем же id и иным payload отклоняется.

Связи: `1—N NormRule`; `0..1—N NormSet` (derived_from — линейная цепь); `1—N MaterialEstimate` (пин версии).

#### NormRule *(pilot core)*
Коэффициент расхода одного материала внутри NormSet. Assumptions структурные (D7), коэффициент — ДИАПАЗОН.

- `id: uuid` (адресуемо и как (norm_set_id, material)).
- `norm_set_id: ref<NormSet>`
- `material: ref<Material>` — по `Material.key` (§4). Unique в NormSet.
- `driving_measure: enum{floor_area_m2, wall_area_m2, ceiling_area_m2, perimeter_m, wet_floor_area_m2}` — что коэффициент умножает.
- `per_unit: NormValue` *(embedded)* — central+lo/hi+confidence (D7). Предсказывает ПОТРЕБЛЕНИЕ (без отхода).
- `unit: enum Unit{m2, kg, l, m, pcs}` — выходная единица.
- `waste_factor: NormValue` *(embedded)* — тоже диапазон (straight~0.10, diagonal~0.15+). Предсказывает ОВЕР-закуп (подрез/бой/паттерн) поверх потребления.
- `assumptions: NormAssumptions` *(embedded)* — структурные условия коэффициента.
- `variability_source: array<enum{substrate_flatness, trowel_notch, layout_pattern, tile_format, joint_width, substrate_absorbency, coats}>` — почему неопределён; драйвит «confirm by experience»-UI и подсказывает что фитить.
- `applies_when: enum{always, wet_only, dry_only}` — wet/dry-ветвление.
- + `SyncMeta` — insert-only (живёт/умирает с NormSet).

Связи: `*—1 NormSet`; embedded NormValue×2 + NormAssumptions; концептуально `1—N MaterialEstimate` (оценка пинит norm_set_id+material, переживает правку rule).

#### NormValue *(embedded)*
Величина-с-неопределённостью (D7-ядро). Переиспользуется в per_unit, waste_factor, MaterialEstimate.quantity.

- `central: float` — точечная оценка (headline).
- `lo / hi: float` — границы. lo==central==hi для стабильных (плитка=1.0); hi>>central для стяжки/клея.
- `confidence: enum{high, medium, low, unvalidated}` — seed стартует unvalidated (честность Risk#1); сужается по мере данных.
- `distribution_hint: enum{point, uniform, triangular, lognormal}?` — для будущего калибратора. Pilot трактует как triangular.

#### NormAssumptions *(embedded)*
Структурная замена free-text. Условия ВНЕ Д×Ш×В, определяющие расход (корень D7).

- `trowel_notch_mm: float?` — клей: главный драйвер kg/m².
- `layout_pattern: enum{straight, diagonal, brick, herringbone}?` — плитка: драйвит waste range.
- `tile_format: enum{small, medium, large, xl_slab}?` — влияет на клей+затирку.
- `joint_width_mm: float?` — затирка.
- `coats: int?` — слои краски/праймера/гидро.
- `layer_thickness_mm: float?` — стяжка/гидро/постель клея. Стяжка = Risk#1-неизвестное.
- `substrate_flatness: enum{good, medium, poor, unknown}?` — стяжка: НЕ выводимо из Д×Ш×В, канонический «норма соврёт здесь». Default unknown → широкий range.
- `substrate_absorbency: enum{low, medium, high}?` — краска: l/m².
- `free_notes: array<string>` — escape-hatch; структурные поля «выпускаются» отсюда со временем.

#### MaterialEstimate *(pilot core)*
ВЫХОД движка для одного материала в одной комнате, ПЕРСИСТЕНТНЫЙ снапшот: количество-диапазон (D7), пин NormSet-версии (D6), оценочная половина пары. Не пересчитывается на лету — норм-правка не переписывает историю.

**Lifecycle (Q#4 — РЕШЕНО):** mutable, пока `Project.status=planning` И на оценку НЕ ссылается ни один `ProcurementActual`/`PurchaseSnapshot`. При первом linked actual ИЛИ создании PurchaseSnapshot → **freeze** (immutable; re-estimate чейнится через `superseded_by`). Lifecycle = поле, не конвенция.

- `id: uuid`
- `org_id: ref<Org>` — D9.
- `project_id: ref<Project>`
- `room_id: ref<Room>` — per-room гранулярность.
- `material: ref<Material>`
- `stage: enum Stage`
- `driving_measure_value: float` — снапшот геометрии на момент оценки (8.4 m²) → воспроизводимость, даже если dims комнаты потом изменятся.
- `quantity: NormValue` *(embedded)* — оценка-диапазон. Композиция диапазонов — по правилу контракта ядра (§8). `central` → дефолт листа.
- `unit: enum Unit`
- `norm_set_id: ref<NormSet>` — ПИН версии **базового** seed. NEVER null. Якорь воспроизводимости.
- `applied_coefficients: AppliedCoefficients` *(embedded, frozen)* — **снапшот ЭФФЕКТИВНЫХ коэффициентов**, реально использованных (per_unit + waste_factor + источник). Закрывает дыру воспроизводимости: после старта калибровки base NormSet один даёт другое число — без этого снапшота калиброванную оценку не воспроизвести и residual не атрибутировать. На пилоте = копия base NormRule; при ручной калибровке = коэффициенты из manual-override NormSet.
- `applied_assumptions: NormAssumptions` *(embedded, frozen)* — снапшот assumptions (reconciliation сравнивает с тем, что ПРЕДПОЛАГАЛИ).
- `resolved_pack_size: float?` — pack_size выбранного Sku на момент оценки (база единиц). Reconciliation работает в base units → pack-rounding атрибутируется каталогу, не норме.
- `computed_at: timestamp`
- `frozen: bool` / `frozen_at: timestamp?` — lifecycle как поле.
- `superseded_by: ref<MaterialEstimate>?` — re-estimate под новой NormSet → старая хранится+линкуется (D6 история).
- + `SyncMeta` — mutable пока `frozen=false`; после freeze → insert-only.

Связи: `*—1 NormSet`, `*—1 Room`/`Project`; `1—N ActualAllocation` (через факты); `1—0..1 MaterialEstimate` (superseded); embedded value-objects.

#### AppliedCoefficients *(embedded)*
Замороженные эффективные коэффициенты, давшие `quantity`.

- `per_unit: NormValue` — реально применённый.
- `waste_factor: NormValue` — реально применённый.
- `source: enum{base_norm, manual_calibration}` — pilot=base_norm; manual_calibration когда из override-NormSet.
- `source_norm_set_id: ref<NormSet>?` — если эффективные коэффициенты пришли из калиброванной версии, отличной от пина seed.

#### ProcurementActual *(pilot core)*
Фактическая половина пары (D6, суть): что Давид реально купил/израсходовал. Записан рядом с оценкой с дня 1. День-1 источник = manual concierge entry; позже = receipt/catalog-link. Часто вводится офлайн в магазине.

- `id: uuid` — client-mint.
- `org_id: ref<Org>` — D9.
- `project_id: ref<Project>` — денорм для rollup.
- `material: ref<Material>`
- `stage: enum Stage`
- `consumed_quantity: float` — реально ИЗРАСХОДОВАНО, base units, net of returns. Ground-truth для **per_unit**.
- `purchased_quantity: float?` — реально КУПЛЕНО (packs × pack_size), base units. Ground-truth для **waste_factor** (см. ниже).
- `leftover_quantity: float?` — остаток на полке (не израсходован). **Q#9 решён сейчас, не позже** — без чистого leftover нельзя ретрофитить waste-данные. `purchased − consumed = leftover` (любые два дают третий; храним явно для устойчивости к ручному вводу).
- `purchased_packs: int?` / `packs_returned: int?` — целые паки куплено/возвращено (остаток сам сигнал).
- `unit: enum Unit` — должна == estimate.unit (guard на reconcile).
- `sku_id: ref<Sku>?` — какой SKU использован (стык §4).
- `sku_free_text: string?` — off-catalog / нет матча → факт остаётся loggable (каталог неполон).
- `actual_price_minor_units: int?` — реально уплачено за пак (центы) — точность цен-ориентира (D10) отдельно от точности норм.
- `observed_conditions: JobConditions` *(embedded)* — реальные параметры (фактический зубец, ровность). Diff против applied_assumptions → «норма врёт» vs «работа off-assumption».
- `observed_driving_measure: float?` — реальная мера (площадь/периметр) если отличается от оценочной (ниша, ошибка замера). Reconciliation факторит геометрию ПРЕЖДЕ чем трогать коэффициент → не двигаем норму из-за ошибки рулетки.
- `source: enum{manual_concierge, receipt, tiler_reported, estimated_by_david}` — provenance + trust-вес.
- `confidence: enum{measured, reported, rough}` — надёжность факта.
- `variance_note: string?` — «основание неровное, +1 мешок стяжки».
- `recorded_by: ref<User>` / `recorded_at: timestamp`
- + `SyncMeta`

**Self-confirmation guard (инвариант):** `source=estimated_by_david` ИЛИ `confidence=rough` → факт reconcilable, но **non-narrowing**: weight=0 для сужения confidence, НЕ увеличивает `NormValue.confidence`. Иначе echo оценки даёт ложную уверенность в невалидированном коэффициенте.

Связи: `1—N ActualAllocation` (фан-аут на оценки); `*—1 Project`; `0..1—1 Sku`; `1—0..1 Reconciliation`; опц. `snapshot_id: ref<PurchaseSnapshot>?`.

#### ActualAllocation *(pilot core)*
Явная аллокация одного факта на одну/несколько оценок (D6, решает Q#6 в схеме, не в политике). Один мешок клея на 2 комнаты → факт фанится на 2 estimate с долями. Ручной ввод на пилоте, но **персистентен и auditable** — суждение прораба не теряется на recompute.

- `id: uuid`
- `org_id: ref<Org>`
- `actual_id: ref<ProcurementActual>`
- `estimate_id: ref<MaterialEstimate>` — `(actual_id, estimate_id)` UNIQUE.
- `consumed_fraction: float` — доля consumed_quantity на эту оценку (Σ по факту = 1.0; default 1.0 при single-room).
- `basis: enum{single_room, manual_split, free_text_map}` — как разрешена аллокация.
- + `SyncMeta`

Связи: `*—1 ProcurementActual`, `*—1 MaterialEstimate`; кормит Reconciliation.

#### Reconciliation *(pilot core)*
Вычисленное сравнение estimate↔actual — обучающий сигнал (D6). **Идемпотентный re-runnable джоб** (не one-shot при вставке): пере-собирает пары, когда оба конца доступны (eventual referential integrity при офлайн-синке). Декомпозирует ошибку на per_unit vs waste vs assumption vs geometry — основа атрибуции.

- `id: uuid`
- `org_id: ref<Org>`
- `estimate_id: ref<MaterialEstimate>` — предсказанная сторона.
- `allocation_id: ref<ActualAllocation>` — наблюдённая (через аллокацию, не сырой actual). `(estimate_id, allocation_id)` UNIQUE.
- `material: ref<Material>` / `norm_set_id: ref<NormSet>` — денорм для группировки/агрегатов «насколько врал seed на клее».
- `estimated_central / actual_consumed: float` — снапшоты на момент reconcile.
- **Декомпозиция ошибки (раздельно — иначе фиттер не знает, что двигать):**
  - `per_unit_observed: float` — `actual_consumed / driving_measure_value`.
  - `per_unit_rel_error: float` — vs `applied_coefficients.per_unit.central`.
  - `waste_observed: float?` — `(purchased_quantity − consumed_quantity) / consumed_quantity` (нужен purchased+leftover).
  - `waste_rel_error: float?` — vs `applied_coefficients.waste_factor.central`.
- `within_range: bool` — попал ли actual в [lo, hi] quantity? D7-метрика успеха: широкий-но-верный = ВЫИГРЫШ; отделяет «честно неуверен» от «уверенно неправ».
- `assumption_delta: array<{field, assumed, observed}>` — field-diff applied vs observed.
- `error_attribution: enum{per_unit_coefficient, waste_factor, assumption_mismatch, geometry_error, within_tolerance, data_quality, mixed}` — вердикт: что двигать (или просто логировать). `geometry_error` когда observed_driving_measure расходится с оценочной.
- `weight: float` — fit-вес = f(confidence, source, площадь); 0 для self-confirmation guard.
- `computed_at: timestamp` — re-runnable, latest wins.
- + `SyncMeta`

Связи: `*—1 MaterialEstimate`, `*—1 ActualAllocation`, `*—1 NormSet`.

#### CalibrationProfile / CalibrationOverride *(deferred)*
Автоматический per-tiler fitting-слой (shadow/min_samples/sample_count/evidence-trail). **Вырезан из пилота:** на N=1 нет фит-движка, который мог бы переобучиться → инфраструктура без сценария. Ручная калибровка покрывается `NormSet`+`derived_from`. Возвращается при (а) втором тайлере или (б) авто-фиттере; сырьё для ретроспективного фита уже копится в Reconciliation. **При возврате:** `min_samples` — per-material (не per-profile), привязан к `Material.variability` (high_variance → больше сэмплов); fitted-нормы либо всегда живут как override (audit-цепь сохраняется), либо при материализации в NormSet несут `source_reconciliation_ids` + `derived_from CalibrationProfile`.

---

### 4. Каталог (курируемый, ГЛОБАЛЬНЫЙ)

D10: цена-ориентир с timestamp+источником, multi-store. **Ownership-решение (Q#1): на пилоте каталог чисто ГЛОБАЛЬНЫЙ** — `org_id` всегда null для каталог-сущностей, **per-tenant override НЕ моделируется** (нет правила резолюции «tenant затеняет global» → породил бы дубль-SKU, ломающие default_sku_id; это та самая дорогая-в-ретрофите вещь, которую не стоит делать наугад). Override — deferred; при возврате решается через стабильный natural key (`store_id + store_sku`) + явный `overrides_id` self-pointer, НЕ через «`org_id` set = override». Каждая каталог-сущность несёт `catalog_version`.

`Substitute` и `Availability` *(deferred)* — авто-резолвер out-of-stock / подбор аналогов; на пилоте out-of-stock = `Sku.active` toggle или ручной выбор другого Sku. Аддитивны.

#### Material *(pilot core)*
Курируемый ВИД материала (таксономия), независим от продукта/магазина. Ядро рассуждает о Material. ~10–15 строк на пилоте.

- `id: uuid` — surrogate PK.
- `key: string` — **стабильный slug, UNIQUE — join-ключ контракта ядра** (`NormRule.material`, `MaterialEstimate.material`, `PurchaseItem.material` ссылаются на `Material.key`; Rust/TS остаются enum-чистыми, расцеплены с db-uuid). floor-tile, tile-adhesive, screed-mix, grout, paint, primer, waterproofing, baseboard. Глобально-уникальны и стабильны (rename = миграция).
- `name: string` — локализованное («Клей плиточный / Cola de azulejo»).
- `category: enum{tile, adhesive, grout, paint, primer, screed, waterproofing, trim, fastener, other}`
- `base_unit: enum Unit` — каноническая единица, в которой ядро квантует; норма выдаёт raw в ней.
- `variability: enum{fixed, ranged, high_variance}` — D7-флаг (интринсик). screed/adhesive=high_variance. Числовой диапазон — в NormRule.
- `default_sku_id: ref<Sku>?` — куратор-пик авто-выбора. Null → fallback cheapest in-stock.
- `active: bool`
- + `SyncMeta` (**global, `catalog_version`**)

Связи: `1—N Sku`; `1—0..1 Sku` (default); `1—N NormRule`/`MaterialEstimate` (по key).

#### Sku *(pilot core)*
Конкретный покупаемый ПРОДУКТ в конкретном магазине. То, до чьих целых паков округляет резолвер.

- `id: uuid` — втекает в `PurchaseItem.sku`.
- `material_id: ref<Material>`
- `store_id: ref<Store>` — (material, store) НЕ unique.
- `title: string` — имя как на полке.
- `brand: string?`
- `store_sku: string?` — код магазина (Leroy ref / EAN). Под будущий scraper + natural key для deferred-override.
- `pack_size: float` — сколько base-units Material в ОДНОМ паке (1.44 m²/коробка, 25 kg/мешок). Округление raw → целые паки.
- `pack_unit: enum Unit` — **ИНВАРИАНТ ПИЛОТА: `pack_unit == Material.base_unit`** (куратор обеспечивает для всех top-материалов; модель НЕ несёт conversion-факторов, поэтому кросс-размерные SKU на пилоте недопустимы).
- `coverage_per_pack: NormValue?` — **escape-hatch** для редкого SKU, где pack продаётся в иной размерности, чем base_unit (напр. 25 kg мешок клея → ~5 m² при зубце 5 мм). Сам ДИАПАЗОН (зависит от условий — тянет к D7). Если задан, резолвер использует его вместо pack_size для конверсии; иначе действует инвариант. Null на пилоте.
- `image_url / url: string?`
- `active: bool` — курация (≠ availability).
- + `SyncMeta` (**global, `catalog_version`**)

Связи: `*—1 Material`/`Store`; `1—N Price` (история, current=latest); `1—N PurchaseItem` (выход).

#### Store *(pilot core)*
Вендор. Multi-store с дня 1 (Leroy PT + локальные Лиссабон). Курируемый, маленький.

- `id: uuid`
- `key: string` — slug, UNIQUE (leroy-pt, local).
- `name: string` — «Leroy Merlin Cascais».
- `kind: enum{chain, local, online}` — chain=scrapeable/url; local=ручная цена.
- `region: string?` / `url: string?`
- `currency: enum` — ISO (EUR). Делает Price-значения однозначными.
- `priority_rank: int?` — куратор-преференс при равных (ниже=предпочтительнее).
- `active: bool`
- + `SyncMeta` (**global**)

Связи: `1—N Sku`; `1—N Price` (через Sku).

#### Price *(pilot core)*
ОРИЕНТИР-наблюдение цены Sku — явно НЕ authoritative (D10). Append-only, timestamped, sourced. Чек Давида = Price с source=receipt.

- `id: uuid`
- `sku_id: ref<Sku>` — (Store через Sku.store_id).
- `amount_minor_units: int` — цена за ПАК в центах (**integer money — без f64-drift на serde/WASM-границе**). Per-base-unit = amount/pack_size.
- `currency: enum` — денорм из Store для self-contained-историчности.
- `captured_at: timestamp` — когда НАБЛЮДЕНА (не insert-time). current = max(captured_at) per Sku.
- `source: enum{manual_curator, store_website, receipt, foreman_report, scraper}` — receipt → калибровка цены.
- `source_ref: string?` — указатель на evidence.
- `is_estimate: bool` — true=guess/placeholder.
- + `SyncMeta` (**global, insert-only**)

---

### 5. Закупки & Этапы

**Две грани (центральное решение):**
- **Грань A (ВЫХОД ядра):** ephemeral, derived, recomputable, без identity/sync — контракт WASM-функции.
- **Грань B (ПЕРСИСТЕНТНО):** tenant-scoped, identity, sync — то, что прораб трогает и из чего учимся.

Почему две: если PurchaseItem персистентен, каждая re-версия норм (D6) молча мутирует «что он купил», убивая estimate-vs-actual. Recomputable-план и immutable-ground-truth = разные lifetimes.

#### Stage *(канонический enum)*
8 этапов; фиксированный ПОРЯДОК (позиционный индекс) драйвит группировку закупок:
`enum Stage{demolition, rough_plumbing_electric, screed, waterproofing, tiling, wall_ceiling_finish, flooring, final}`. Label через STAGE_LABELS (RU; PT/i18n позже), на render. НЕ per-tenant таблица на пилоте (промотить в ordered-таблицу когда второй тайлер / иная последовательность — D9 = schema tenant-ready, не каждый lookup configurable).

#### Грань A — value-objects *(ephemeral, NO sync, NOT tenant-scoped)*

- **PurchaseList:** `project_id: ref<Project>`, `by_stage: array<PurchaseStageGroup>` (canonical order, пустые опущены), `total: MoneyRange`, `norm_set_id: uuid` (пин для UI/freeze), `catalog_version: string`, `computed_at: timestamp`, `currency: enum{EUR}`.
- **PurchaseStageGroup:** `stage: enum Stage`, `stage_label: string?` (денорм для PDF), `items: array<PurchaseItem>`, `subtotal: MoneyRange`.
- **PurchaseItem:** `material: ref<Material>`, `stage: enum Stage`, `quantity: QuantityEstimate` (D7), `unit: enum Unit`, `sku: ref<Sku>` (выбранный), `pack_size: float` (resolved, для воспроизводимости), `packs: PackEstimate` (D7-диапазон ceil), `line_total: MoneyRange` (is_estimate=true), `availability: enum{in_stock, out_of_stock, unknown}` (на пилоте всегда unknown).
- **QuantityEstimate** *(embedded)*: `low/expected/high: float`, `confidence: enum{exact, estimated, wide}`. *Та же семантика, что `NormValue` (central=expected).*
- **PackEstimate** *(embedded)*: `low/expected/high: int` (ceil(bound / pack_size)). high = «buy up to» против потерянного дня.
- **MoneyRange** *(embedded)*: `low/expected/high_minor_units: int` (центы), `currency: enum{EUR}`, `is_estimate: bool` (всегда true → UI метит «ориентир»).

#### PurchaseSnapshot *(pilot core, Грань B)*
Иммутабельная заморозка PurchaseList в момент действия («лист, который взял в Leroy на стяжку»). Оценочный якорь для ProcurementActual; триггер freeze связанных MaterialEstimate.

- `id: uuid` — client-mint.
- `org_id: ref<Org>` / `project_id: ref<Project>`
- `scope: enum{full_project, single_stage}` — закупочный поход = этап.
- `stage: enum Stage?` — set когда single_stage.
- `frozen_list: json<PurchaseList>` — точный Грань-A payload на момент freeze, opaque blob. **Воспроизводимость держится на этом blob (фактически использованные Sku/pack_size/Price by value), НЕ на catalog_version-lookup** — офлайн-снапшот против неполного кэша остаётся самодостаточен.
- `norm_set_id: ref<NormSet>` — D6.
- `catalog_version: string` — D10: price drift атрибутируем отдельно от norm error (информационный, не для воспроизведения).
- `created_by_user_id: ref<User>` / `created_at: timestamp`
- + `SyncMeta` — **insert-only** (immutable history).

Связи: `*—1 Org/Project`; `1—N ProcurementActual`.

#### PurchaseLineSelection / ReorderPing *(deferred)*
- **PurchaseLineSelection** — персистентные per-line правки прораба (chosen_sku/pack_override/included) поверх свежего выхода ядра (D8 для листа), re-attach по `line_key=stage::material`. На раннем пилоте recompute + PurchaseSnapshot freeze покрывают «что взял в магазин»; вводится когда Давид начнёт реально подменять SKU/исключать линии.
- **ReorderPing** — workflow-движок напоминаний о дозаказе (зависит от `StageSchedule`, тоже deferred). Standalone-фича, добавляется без миграции существующих данных.

---

### 6. Чертёж (LayoutState, D8)

Persisted drawing-edits. `naiveTileGrid()` (compute-core) — ЧИСТЫЙ детерминированный baseline. НЕ храним пиксели/SVG. Храним: (a) layout-INPUT-params, восстанавливающие baseline, + (b) MANUAL OVERRIDES как патч. Re-render = baseline(params) THEN apply overrides → правки переживают апгрейд движка как diff.

**Правило source-of-truth (явная асимметрия):** baseline всегда пересчитывается из **LIVE room dims** (читаются из Room) + **PINNED tile dims** (денорм в LayoutState — воспроизводимо даже при смене SKU, D10). Stale-detection через `baseline_params_hash` на open; CutOverrides НИКОГДА не авто-применяются без hash-match.

#### LayoutState *(pilot core)*
Один на (room, surface, material).

- `id: uuid` — + полный SyncMeta. First-class synced (D8).
- `org_id: ref<Org>` / `room_id: ref<Room>`
- `surface: enum{floor, wall_N, wall_E, wall_S, wall_W, ceiling}` — несколько поверхностей, каждая свой датум. Walls по ориентации (стабильно при смене dims; non-rect позже сломает адресацию — defer).
- `material: ref<Material>` — floor-tile / wall-tile.
- `sku_id: ref<Sku>?` — физ. размеры плитки → baseline-математика. Nullable до выбора.
- `tile_width_m / tile_height_m: float` — **PINNED** денорм из SKU.
- `grout_gap_mm: float` — шов; phase-2 solver, intent захвачен сейчас.
- `pattern: enum{grid, brick_50, brick_33, herringbone, diagonal}` — pilot рендерит только grid; прочее = персистентный INTENT для solver фазы-2.
- `datum: LayoutDatum` *(embedded)* — референс-начало раскладки (D8 «датум») — главное, чем тайлер управляет; должно персиститься как intent.
- `rotation_deg: float` — диагональ; 0 на пилоте.
- `baseline_params_hash: string` — хеш входов (live dims + pinned tile dims + datum + pattern + engine semver). На re-open др. hash → overrides помечаются stale, не misapply.
- `engine_version: string` — semver compute-core baseline.
- `viewport: CanvasViewport?` *(embedded)* — pan/zoom (D4), чистый UX, отдельно от геометрии.
- `notes: string?`
- + `SyncMeta`

Связи: `*—1 Room`, `*—0..1 Sku`; `1—N CutOverride`.

#### LayoutDatum *(embedded)*
- `mode: enum{corner, centered, anchored_point, anchored_edge}` — corner=engine default; centered=балансированные подрезы; anchored=целая плитка у точки/края.
- `anchor_x_m / anchor_y_m: float` — якорь в surface-local метрах.
- `offset_x_m / offset_y_m: float` — тонкий сдвиг сетки.

#### CanvasViewport *(embedded)*
`pan_x_px / pan_y_px: float`, `zoom: float` (1.0=fit, clamp в UI).

#### CutOverride *(pilot core)*
ОДНА ручная правка ОДНОЙ ячейки baseline-сетки (D8 «подрезка»). Список = diff поверх recomputed baseline. Каждая правка — строка → per-edit sync-гранулярность, audit человек-vs-движок. Адресуется grid-координатами (не пиксели).

- `id: uuid` — + SyncMeta (синкается независимо).
- `org_id: ref<Org>` / `layout_state_id: ref<LayoutState>`
- `cell_col / cell_row: int` — логический адрес в baseline-сетке (стабилен под zoom/pan; re-validate против baseline_params_hash).
- `kind: enum{mark_cut, suppress, annotate}` — pilot-набор для grid-раскладки с ручной подрезкой. *(Deferred enum-values: merge, shift, reuse_offcut — для solver фазы-2; расширить enum дёшево.)* suppress = нет плитки (трап/ниша).
- `cut_width_mm / cut_height_mm: float?` — финишные размеры подреза при mark_cut → реальные vs naive ceil().
- `payload: json` — kind-specific (текст аннотации). Typed-on-read.
- `superseded_by_baseline: bool` — true (не hard-delete) когда recompute baseline инвалидирует ячейку (комната уменьшилась). Intent виден-но-помечен, не молча выброшен.

*(Known limitation: при multi-device правка геометрии комнаты на устройстве B инвалидирует overrides устройства A → stale, ручное ре-применение. Pilot single-device не выстрелит. Долгосрочный фикс: якорить override к относительной позиции от датума, не к индексу ячейки.)*

---

### 7. ER-сводка (cardinality, pilot core)

```
Org 1───N Membership N───1 User        (User *──* Org через Membership)
Org 1───N Project 1───N Room
Room 1───N WorkSelection (embedded), 1───N Opening (embedded)
Room 0..1───N RoomTemplate (applied_template_id, слабая, global)

NormSet 1───N NormRule
NormSet 0..1───N NormSet (derived_from, линейная цепь версий)
NormRule.material ──ref(key)── Material

Material 1───N Sku N───1 Store
Material 1───0..1 Sku (default_sku_id)
Sku 1───N Price

Room 1───N MaterialEstimate
MaterialEstimate 1───N ActualAllocation N───1 ProcurementActual   (фан-аут факта на оценки)
MaterialEstimate 0..1───1 MaterialEstimate (superseded_by)
ProcurementActual 0..1───1 Sku, 0..1───1 PurchaseSnapshot
(MaterialEstimate, ActualAllocation) 1───0..1 Reconciliation
Reconciliation N───1 NormSet

Project 1───N PurchaseSnapshot 1───N ProcurementActual
Room 1───N LayoutState 1───N CutOverride
LayoutState 0..1───1 Sku

[Грань-A ephemeral, БЕЗ FK-владения]
PurchaseList 1───N PurchaseStageGroup 1───N PurchaseItem ──ref── Material, Sku

[Deferred] Device · RoomGroup · StageSchedule · CalibrationProfile/Override ·
           Substitute · Availability · PurchaseLineSelection · ReorderPing
```

---

### 8. Контракт compute-core (Rust)

Ядро (D2) — ЧИСТЫЙ модуль: `compute(input) -> output`. Без identity, tenant, sync, persistence, network. Выразимо serde-структурами Rust и TS-типами (D3). Ядро НЕ видит §1, sync-поля, catalog-storage.

**ВХОД (подмножество):**
- `ProjectInput`: голая геометрия — `rooms: Vec<RoomInput>` (без org_id/owner/sync/status/address).
- `RoomInput`: `length_m`, `width_m`, `height_m`, `type`, `wet`, `openings`, `works`. **БЕЗ** id/sync/template-provenance/measurement_source/notes (app-метаданные; ядру нужна только физика+работы).
- `NormSet` + `NormRule` (+ embedded `NormValue`, `NormAssumptions`) как чистые данные. **Эффективные коэффициенты резолвятся app-слоем** в плоский набор ПЕРЕД передачей (ядро не ходит в калибровку — получает готовое; app затем фиксирует их в `MaterialEstimate.applied_coefficients`).
- Каталог-подмножество: плоский `Vec<SkuView{material_key, pack_size, pack_unit, coverage_per_pack?, current_price_minor_units, availability}>` — app проецирует §4 (ядро не знает Store/Price-историю).
- Геометрия плитки: `tile_width_m`, `tile_height_m`, `datum`, `pattern`, `Vec<CutOverride-as-data>` — чистые данные раскладки.

**ВЫХОД (подмножество):**
- `Vec<MaterialEstimate-core>`: `material(key)`, `stage`, `driving_measure_value`, `quantity: NormValue`, `unit`, `norm_set_id`, `applied_coefficients`, `applied_assumptions`. **Без SyncMeta** — app оборачивает в персистентный MaterialEstimate (добавляет org_id/sync/id/freeze).
- Вся **Грань A** (`PurchaseList`/`PurchaseStageGroup`/`PurchaseItem` + value-objects), ephemeral, recomputable.
- Геометрия чертежа: `baseline grid (cols/rows/cells)` + применённые overrides → данные для Canvas (D2 «отдаёт данные, не пиксели»).

**Правило композиции диапазонов (D7, ОДНА документированная функция — Rust↔TS детерминизм, D2/D3):**
`quantity.central = driving_measure_value × per_unit.central × (1 + waste_factor.central)`.
Границы: `per_unit` несёт основную неопределённость; `waste_factor` применяется как скалярная полоса поверх — `quantity.lo = driving × per_unit.lo × (1 + waste_factor.central)`, `quantity.hi = driving × per_unit.hi × (1 + waste_factor.hi)`. НЕ перемножать lo×lo / hi×hi независимо (компаундит в бессмысленно-широкий hi, обнуляет ценность within_range). Конверсия pack: если `coverage_per_pack` задан — использовать его, иначе инвариант `pack_unit == base_unit`.

**Unit invariant:** ядро отвергает SkuView, где `pack_unit ≠ base_unit` И `coverage_per_pack` отсутствует (вместо тихого mis-round).

**APP/SERVER-ONLY (ядро НЕ видит):** весь §1; все SyncMeta-поля; catalog-STORAGE (Store/Price-история/catalog_version/curation); Грань B целиком (PurchaseSnapshot/ProcurementActual/ActualAllocation/Reconciliation, резолв калибровки → коэффициенты ДО вызова ядра); template-provenance/measurement_source/статусы/заметки.

---

### 9. Локально (IndexedDB) vs сервер

Offline-first: данные рождаются в IndexedDB на стройке, синкаются позже. Каждая owned-строка несёт sync-конверт.

| Категория | IndexedDB (клиент) | Сервер | Заметка |
|---|---|---|---|
| §1 Identity (Org/User/Membership) | да (кэш + офлайн auto-provision) | да (источник истины) | Fresh install → silent auto-create Org+User+Membership(owner) с UUID; attach реальной identity на первом sync. |
| §2 Project/Room/Templates | да (Project/Room создаются офлайн) | да | RoomTemplate глобальные → pull/bundled, read-on-client. |
| §3 NormSet/NormRule (seed) | кэш (read-mostly, bundled или pull) | источник | Глобальный seed read-only на клиенте. insert-only. |
| §3 MaterialEstimate / ProcurementActual / ActualAllocation / Reconciliation | да (estimate+actual+аллокация вводятся офлайн на месте) | да | Calibration corpus. Actual часто офлайн в магазине. |
| §4 Каталог (Material/Sku/Store/Price) | КЭШ (read-mostly; curator пишет редко) | источник истины (курируется, GLOBAL) | Клиент почти не пишет. Price insert-only. |
| §5 Грань A (PurchaseList/Item) | вычисляется на лету в WASM, НЕ хранится | нет | Ephemeral. Recompute при изменении входов. |
| §5 Грань B (PurchaseSnapshot) | да (freeze офлайн) | да | frozen_list — blob, самодостаточен для воспроизводимости. insert-only. |
| §6 LayoutState/CutOverride | да (Canvas-правки офлайн, частые) | да | Per-edit sync-гранулярность; coalesce/debounce outbox при активном редактировании. |
| `sync_status`, `last_synced_revision` | ТОЛЬКО клиент | — | Не реплицируются (отношение строки к серверу, per-device). |
| `SyncOutboxEntry` | ТОЛЬКО клиент | — | Durable очередь офлайн-мутаций (см. ниже). Сам не несёт org_id/SyncMeta. |

---

### 10. Sync-стратегия

**ID:** client-mint UUIDv7 на каждой owned-строке (офлайн-mint без центральной последовательности). Родитель и ребёнок шарят id-пространство офлайн → cross-entity ref (`estimate_id`, `actual_id`, `sku_id`, `snapshot_id`) валиден ещё до прихода родителя. **FK мягкие на уровне sync, целостность eventual** — сервер принимает строку с временно-висящей ссылкой, не роняет её; reconcile-джоб ретраит несобранные пары.

**Версионирование / конфликты:** `revision` — **server-assigned** (сервер инкрементит, возвращает; клиент НЕ выдумывает следующий номер). Мутация несёт `base_revision` (= `last_synced_revision`, что клиент прочитал). Конфликт = `base_revision ≠` текущей серверной revision. Совпадение номеров на форке невозможно (сервер — единственный источник). Pilot N=1 single-device: detect + alert + **LWW-with-warning**; реальный merge-UI отложен. `lamport`/`device_id` reserved под multi-device (тогда — version-vector вместо скаляра). Клиентские `created_at`/`updated_at` — только UI/аудит, НИКОГДА не авторитетный merge-tiebreaker.

**Идемпотентность:** sync = at-least-once. Каждая outbox-запись несёт `mutation_id` (client-mint uuid); сервер дедупит по окну применённых mutation_id → повторный пуш (потерянный ACK на стройке) = no-op + повторный ACK. Защищает от двойного ProcurementActual (двойной факт = испорченный reconcile).

**Trust boundary:** на write для owned-строк сервер ИГНОРИРУЕТ client-присланный `org_id` и проставляет из аутентифицированной membership пушера (или отвергает строку, чей org_id ∉ membership). На read — RLS-предикат из серверной сессии, не из запроса. Глобальные reference-строки (org_id=null): пишет только curator-роль, обычный клиент pull-ит read-only.

**Insert-only класс (immutability через политику, не поле):** для `NormSet`, `NormRule`, `Price`, `PurchaseSnapshot`, frozen `MaterialEstimate` (frozen=true), записанный `ProcurementActual` — сервер: create-once, любой upsert с существующим id и иным payload отклоняется (НЕ LWW). Защищает ground-truth от тихой фальсификации истории. Mutable: `Room`, `Project`, `Membership`, `LayoutState`/`CutOverride`, `MaterialEstimate` пока frozen=false.

**Soft-delete / tombstone:** `deleted`+`deleted_at`, синкается (не физическое удаление). Delete-vs-update — отдельный конфликт-класс: upsert строки, для которой существует tombstone с более новой server-revision → delete выигрывает (resurrection блокируется), клиенту возвращается deleted. Tombstone хранится дольше max-офлайн-окна (напр. 90 дней) с hard-таймаутом + device-retirement-политикой — НЕ reap по простому last_seen ack (старое устройство в кармане не должно воскрешать удалённое). На пилоте single-device GC тривиален; политика — под multi-device.

**SyncOutboxEntry (local-only):** `seq` (replay order), `mutation_id` (dedup), `op{upsert, delete}`, `entity_type`, `entity_id`, `base_revision` (токен конкуренции), `payload` (snapshot), `attempt_count`, `last_error`. Дренится по порядку при коннекте, потом удаляется. Все операции идемпотентны по mutation_id. Детали реализации движка — при написании sync-кода.

---

### 11. Остаточные открытые вопросы

**Решено в этой версии (бывшие open):** estimate-freeze lifecycle (поле `frozen`), unit-инвариант + `coverage_per_pack`, catalog=global, calibration-provenance (`applied_coefficients`), waste/consumption split, error-decomposition, cross-room `ActualAllocation`, server-assigned revision + mutation_id + trust-boundary + insert-only + tombstone-окно, self-confirmation guard, geometry-error attribution, range-composition rule, integer money, `Material.key` как join-ключ, `line_key=stage::material`, soft-ref `created_by`.

**DECIDE BEFORE / EARLY PILOT (нужен вход Димы):**
1. **Seed-источник коэффициентов** (`basis=expert_seed`): Leroy datasheets vs gut Давида vs published PT-нормы. Влияет на стартовые confidence-метки. Sourcing, не схема.
2. **Корреляция waste_factor ↔ per_unit** (диагональ повышает И подрез, И слегка клей): пилот трактует независимо (range-composition выше). Флаг если reconciliation покажет coupled errors — covariance-поля не вводим сейчас.
3. **Off-catalog actuals** (`sku_free_text`): на N=1 ручная сверка / lightweight «map free-text → material» (через `ActualAllocation.basis=free_text_map`). Подтвердить ручной режим.

**DEFERRED — revisit at trigger (B2B / multi-device / solver phase-2):**
4. Per-tenant catalog override (триггер: дивергирующие B2B-каталоги) — резолв через natural key + `overrides_id`, НЕ через `org_id`.
5. `CalibrationProfile`/`Override` авто-фит + per-material `min_samples` (триггер: 2-й тайлер / авто-фиттер).
6. `Device`-реестр, version-vector merge, lamport-ordering, tombstone-GC-движок (триггер: 2-е устройство).
7. `WorkSelection`/`Opening` → first-class строки для field-level merge (триггер: multi-device правки одной комнаты).
8. `Substitute`/`Availability` авто-резолвер out-of-stock (триггер: scraper / частый out-of-stock).
9. `ReorderPing`+`StageSchedule` тайминг-движок дозаказа (триггер: реальная боль позднего дозаказа).
10. `PurchaseLineSelection` overlay (триггер: Давид начинает подменять SKU / исключать линии).
11. `RoomGroup` двухуровневая группировка (триггер: многокомнатные квартиры/этажи).
12. `Stage` enum → per-tenant ordered-таблица (триггер: иная последовательность этапов).
13. Non-rect комнаты ломают `LayoutState.surface` orientation-keys и `Opening` без id (триггер: непрямоугольная геометрия / Canvas-редактирование позиции проёма → проёму нужен id + offset).
14. `CutOverride` относительная-позиция привязка вместо cell-index (триггер: multi-device geometry-edit invalidation).