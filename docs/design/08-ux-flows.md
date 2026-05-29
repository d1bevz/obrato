# 08 · UX и потоки

> Глава дизайн-дока. **Только UX-дизайн** - экраны, пользовательские флоу,
> модель ввода и визуальные решения для пилота. Не меняет решения D1-D10,
> модель данных гл. 05 и контракт ядра. UX живёт поверх Project, Room,
> WorkSelection, LayoutState, PurchaseList, PurchaseSnapshot и ProcurementActual.

Главный пользователь пилота - прораб Давид на объекте, с Android-телефоном, в
спешке и иногда в перчатках. Поэтому интерфейс оптимизирован не под
«спроектировать ремонт», а под «быстро ввести комнату -> получить закупочный лист
и черновой чертёж -> поправить руками -> взять лист в магазин».

Визуальный макет ключевых экранов: [mockups/08-ux-mobile-screens.html](mockups/08-ux-mobile-screens.html).

---

## 0. UX-решения

1. **Шаблон -> дельта, а не анкета.** Room.type предзаполняет wet,
   openings и works; Давид правит только отличия. Это сохраняет модель гл. 05:
   источник WorkSelection.source остаётся template или user.
2. **Минимум Q4 = четыре крупные работы.** В UI есть ровно четыре первичные
   карточки состава работ, совпадающие с WorkKind: floor, walls, ceiling,
   electric_points. Параметры раскрываются только когда реально меняют расчёт.
3. **Комната - единица ввода.** Никакого глобального мастера на 20 шагов. Прораб
   зашёл в комнату, проверил размеры, галочки, проёмы, получил локальный результат.
4. **Честная неопределённость видна, но не мешает.** В листе показывается диапазон
   количества и метка confidence количества. Норма объясняется отдельным раскрытием
   NormRangeView, чтобы не смешивать confidence нормы и confidence строки листа.
5. **Canvas - ручной рабочий инструмент.** MVP показывает наивную grid-раскладку,
   а доверие строится через tap-to-cut / suppress / annotate. Solver подрезки не
   прячется за красивым UI.
6. **Offline-first выглядит спокойно.** OfflineBadge в шапке показывает сеть и
   непушнутые правки. Ни один основной шаг не блокируется отсутствием сети.

---

## 1. Карта экранов

| Экран | Маршрут | Главная задача | Читает / пишет |
|---|---|---|---|
| ProjectList | /projects | выбрать объект или создать новый | Project[], aggregate sync_status |
| ProjectDetail | /projects/:id | увидеть готовность объекта: комнаты, лист, чертежи, факты | Project, Room[], последний compute output |
| RoomEditor | /projects/:id/rooms/:roomId | ввести ДхШхВ, wet, проёмы и 4 work-card | Room, embedded Opening[], WorkSelection[] |
| LayoutCanvas | /rooms/:roomId/layout/:surface | выбрать плитку и поправить grid-раскладку | LayoutState, CutOverride, DrawingGeometry |
| PurchaseList | /projects/:id/purchase | список закупок по этапам, диапазоны, freeze | ephemeral PurchaseList, пишет PurchaseSnapshot |
| ProcurementEntry | /snapshots/:id/actuals/new | внести факт покупки в магазине/на объекте | ProcurementActual, ActualAllocation |

ProjectDetail остаётся хабом пилота. Отдельный экран калибровки не нужен: CTA
«пересчитать по новым нормам» живёт на detail после ручного Reconciliation.

---

## 2. Сквозной поток

~~~mermaid
flowchart TD
    A[ProjectList: выбрать объект] --> B[ProjectDetail: комнаты и статус]
    B --> C[RoomEditor: размеры + wet + 4 работы]
    C --> D{Сохранить комнату}
    D --> E[ComputeClient -> Worker/WASM]
    E --> F[ProjectDetail: расчёт готов]
    F --> G[LayoutCanvas: grid + ручные правки]
    F --> H[PurchaseList: этапы + диапазоны]
    G --> H
    H --> I{Взять в магазин}
    I --> J[PurchaseSnapshot freeze]
    J --> K[ProcurementEntry: факт закупки]
    K --> L[ActualAllocation + sync outbox]
    L --> M[Reconciliation on-demand позже]

    C -. offline local write .-> X[(IndexedDB + SyncOutbox)]
    G -. offline local write .-> X
    J -. insert-only .-> X
    K -. insert-only .-> X
~~~

Критичный UX-момент: compute запускается после сохранения комнаты и на ProjectDetail
виден как «лист обновлён». Не надо заставлять Давида думать о worker/WASM, версиях
норм или каталоге. Он видит: комната введена, список пересчитан, часть строк широкая
и требует уточнения.

---

## 3. Модель ввода Q4

### 3.1 Первичный ввод

RoomEditor строится из трёх компактных блоков:

1. **Комната:** тип, название, размеры ДхШхВ, источник замера.
2. **Условия:** wet, проёмы, короткая заметка, только если нужно.
3. **Состав работ:** четыре крупные карточки.

Карточки состава работ:

| UI-карточка | WorkSelection.kind | Default source | Минимальные параметры |
|---|---|---|---|
| Пол | floor | RoomTemplate.default_works | floor_finish, tile_pattern если плитка |
| Стены | walls | RoomTemplate.default_works | tile_pattern для плитки, paint_coats для покраски |
| Потолок | ceiling | RoomTemplate.default_works | paint_coats, default 2 |
| Электроточки | electric_points | RoomTemplate.default_works | sockets, switches, lights |

Это закрывает Open Q4 без новой сущности. UI может называть карточку «Стены:
плитка/покраска» через шаблон и правила норм, но persisted-модель остаётся прежней:
WorkSelection.kind + существующие параметры. Полная taxonomy отделок отложена до
реального триггера.

### 3.2 Шаблоны по типу комнаты

Стартовые шаблоны должны покрыть ~80% типовых объектов Давида:

| RoomType | wet default | floor | walls | ceiling | electric_points |
|---|---:|---|---|---|---|
| bathroom | true | tile, straight | tile/waterproofing package, straight | paint, 2 coats | 1 socket · 1 switch · 2 lights |
| kitchen | false | tile, straight | paint, 2 coats | paint, 2 coats | 5 sockets · 2 switches · 2 lights |
| bedroom | false | laminate/vinyl default | paint, 2 coats | paint, 2 coats | 4 sockets · 1 switch · 1 light |
| living | false | laminate/vinyl default | paint, 2 coats | paint, 2 coats | 6 sockets · 2 switches · 2 lights |
| hallway | false | tile/laminate default | paint, 2 coats | paint, 2 coats | 1 socket · 2 switches · 2 lights |
| other | false | off | off | off | off |

Числа электроточек - не трассы кабеля и не расчёт проводки. Это только позиции
точек для списка/чертежа MVP, как зафиксировано в гл. 02 и 05.

### 3.3 Правка дельты

После применения шаблона карточки визуально разделяются:

- **Template** - серый бейдж, можно оставить без чтения деталей.
- **Changed** - оранжевый бейдж, если Давид поменял enabled или параметры.
- **Needs check** - жёлтый бейдж, если расчёт зависит от Risk #1 input:
  ровность основания, шов плитки, впитываемость, высота захода гидроизоляции.

Сброс «вернуть шаблон комнаты» доступен, но не основной. Главное действие -
«Сохранить и пересчитать».

---

## 4. Экранные сценарии

### 4.1 ProjectList

Цель: найти активный объект за один тап. Карточка проекта показывает:

- название и адрес/район;
- сколько комнат замерено;
- есть ли freeze-лист в магазин;
- sync/offline состояние, но не как предупреждение.

Primary action: «Новый объект». Secondary: поиск/фильтр по активным/готовым, позже.

### 4.2 ProjectDetail

Хаб объекта. Верхний блок отвечает на три вопроса:

- сколько комнат готово;
- есть ли свежий закупочный лист;
- что делать дальше.

Список комнат ведёт в RoomEditor. Быстрые CTA:

- «Добавить комнату»;
- «Список закупок»;
- «Чертежи» - открывает список поверхностей/комнат с LayoutState.

Калибровочный результат показывается здесь только когда есть факты: «Новые нормы
сузят диапазон клея/краски. Пересчитать?» Это не отдельный workflow пилота.

### 4.3 RoomEditor

Mobile-first форма без длинной анкеты:

- размеры как три крупные numeric input с единицей m;
- wet как явный switch рядом с типом комнаты;
- проёмы collapsed по умолчанию: «1 дверь» / «+ окно»;
- 4 work-card в два столбца на широком телефоне или один столбец на 360px.

Валидация должна быть физической и локальной:

- размеры > 0;
- проём не больше стены;
- template_default размеры видны как «не замерено» и не идут в fit;
- если wet=true, но выключены floor/walls, UI показывает мягкую проверку, не блок.

### 4.4 LayoutCanvas

Цель: дать Давиду доверяемый чертёж, не идеальный solver.

Экран состоит из:

- верхней строки surface + размер плитки + pattern;
- Canvas full-width, без декоративной рамки;
- нижней панели команд: datum, cut, suppress, note, undo;
- статуса hash: если room dims или tile dims изменились, overrides помечены stale.

Tap ведёт не в пиксель, а в логический адрес ячейки (cell_col/cell_row). Это
согласовано с CutOverride: правки переживают pan/zoom и переразмеривание canvas.

### 4.5 PurchaseList

Лист группируется по каноническим этапам из гл. 02/05. Пустые этапы не показываем.

Строка материала:

- material + выбранный SKU;
- QuantityEstimate low-expected-high;
- pack estimate (buy 4-5 bags);
- цена как MoneyRange с явной меткой «ориентир»;
- confidence количества: exact, estimated, wide.

Важно: строка листа не показывает NormValue.confidence напрямую. Для нормы есть
раскрытие «почему диапазон широкий», где NormRangeView объясняет assumption:
«стяжка зависит от ровности основания», «затирка зависит от шва».

Freeze:

- кнопка «Взять в магазин» создаёт PurchaseSnapshot;
- можно freeze весь проект или один этап;
- после freeze строки становятся историей, не live lookup каталога.

### 4.6 ProcurementEntry

Форма факта заточена под магазин:

- выбрать frozen stage/list;
- отсканировать/найти SKU позже, на пилоте - ручной выбор/название;
- packs/quantity/price;
- source/confidence: measured/reported/rough + estimated_by_david guard.

Если факт rough или «по оценке Давида», он участвует в reconcile как история, но не
сужает нормы. UI пишет это одной строкой: «Для истории, не для калибровки».

---

## 5. Визуальные принципы

- **Рабочая плотность, не маркетинг.** Первый экран - список объектов/комнат, не
  hero. Много воздуха не нужно, но группы должны сканироваться.
- **Touch target минимум 48px.** Кнопки и work-card должны нажиматься большим
  пальцем и в перчатке.
- **Основное действие одно.** На RoomEditor это «Сохранить и пересчитать», на
  PurchaseList - «Взять в магазин», на Canvas - текущий режим редактирования.
- **Цвет несёт состояние.** Зелёный/teal - готово, оранжевый - пользовательская
  правка, жёлтый - требует проверки, красный - блокирующая физическая ошибка.
- **Текст короткий.** Не объяснять строительные нормы в экранном тексте. Длинное
  объяснение живёт в раскрытии строки или в доке, не в основном флоу.
- **No fake precision.** Диапазон и «ориентир» лучше, чем красивая точная цифра.

Минимальные дизайн-токены для первого UI:

| Token | Значение | Использование |
|---|---|---|
| --bg | #f7f6f1 | фон app shell |
| --surface | #ffffff | формы и строки |
| --ink | #202522 | основной текст |
| --muted | #69726d | вторичный текст |
| --action | #0b7a75 | primary CTA / ready |
| --changed | #d8662a | changed by user |
| --check | #c7a62b | needs check / wide range |
| --danger | #b64b3b | validation block |

---

## 6. Acceptance для UX-главы

- Содержит все маршруты из гл. 09 §1 и не добавляет новый обязательный экран.
- Решает Q4 через существующий WorkSelection.kind, без новых сущностей.
- Разводит два confidence-уровня: NormValue.confidence и
  QuantityEstimate.confidence.
- Учитывает offline-first: Room, Layout, Snapshot и Actual пишутся локально.
- Показывает, где freeze создаёт immutable PurchaseSnapshot.
- Canvas-правки описаны как CutOverride поверх baseline, не как изменение геометрии
  ядра.

---

## 7. Не делать в пилоте

- Не строить визуальный дизайн для заказчика или дизайнера интерьера.
- Не добавлять taxonomy всех отделок до реального запроса Давида.
- Не строить solver профессиональной раскладки плитки вместо editable grid.
- Не превращать нормы в точечные числа ради «красивого» листа.
- Не делать merge-UI для multi-device конфликтов: пилот single-device.
