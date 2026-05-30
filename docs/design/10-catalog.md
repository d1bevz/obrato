# 10 · Каталог (курируемый, глобальный)

> Как собирается и поддерживается курируемый каталог материалов Obrato: из чего движок
> берёт SKU для листа закупок. Строго по схеме **гл.05 §4** (Material → Sku → Store →
> Price), цена = **ориентир** (**D10**), связка с нормами **гл.07** через `base_unit`.
> Якорь — реальные покупки Давида; на момент написания пилот **pre-concierge**, поэтому
> каталог = **best-effort** по реальным продуктам рынка Лиссабона, валидируется на объекте.

## 0. Решения этой главы (TL;DR)

- Каталог — **глобальный read-only seed** (`org_id=null`, гл.05 §4 Q#1): `Material → Sku →
  Store → Price`. Per-tenant override — deferred.
- Состав: **141 SKU**, **9 материалов**, **9 магазинов** (Leroy + 8 реальных по Лиссабону),
  **144 цены**. Файл: `compute-core/src/catalog/seed.json` (форма `CatalogSeed`, `seed-types.ts`).
- **Цена = ОРИЕНТИР (D10):** integer money (центы), append-only, `is_estimate=true`,
  `source=manual_curator`, `captured_at=2026-05-30`. В листе помечается «уточни в магазине».
- **Open Q2 РЕШЁН:** каталог покрывает реальный набор магазинов — `Leroy Merlin PT` (chain,
  якорь) + 8 реальных: Obramat, Maxmat, Brico Depôt, Armazéns Reis, Aleluia, Coriprel, BigMat,
  Bricomarché (priority-ranked). Дефолты остаются на Leroy; реальный набор Давида уточняется в
  concierge. **AKI = Leroy** (слияние) — не считать отдельно.
- **Инвариант пилота:** `Sku.pack_unit == Material.base_unit` (0 нарушений в seed).
- Каталог **неполон by design** → off-catalog путь (`ProcurementActual.sku_free_text`).
- Движок не хранит каталог: app проецирует §4 → плоский SkuView (гл.05 §8). Проекция —
  `project-seed.ts`, заменила прежнюю `SAMPLE_CATALOG`-заглушку.

---

## 1. Роль каталога в системе

Каталог и нормы (гл.07) — две половины одного расчёта:

```
норма (гл.07): driving_measure × per_unit × (1+waste) → RAW в base_unit материала
каталог (тут): Material.default_sku → Sku.pack_size (в той же base_unit) → ceil(raw/pack_size)
             → целые упаковки × Price.amount → лист закупок (ориентир-цена)
```

Ключевая стыковка: **`Sku.pack_size` выражен в той же `base_unit`, в которой норма выдаёт
расход** (клей — kg, плитка — m², краска — l, плинтус — m). Иначе округление raw → паки
молча соврёт. Это и есть смысл **инварианта пилота** (§2).

Каталог **глобальный и read-only** на клиенте (гл.05 §4 Q#1, §9): `org_id=null`, пишет
только curator-роль (гл.05 §10 trust boundary), клиент pull-ит и кэширует. Каталог
**неполон по определению** — реальный объект всегда подкинет позицию вне курации; для этого
есть **off-catalog путь**: факт логируется через `ProcurementActual.sku_free_text` без матча
в каталог (гл.05 §4, §11 Q#3), суждение прораба не теряется.

Ядро (compute-core) **не видит** Store/Price-историю/курацию (гл.05 §8) — app-слой проецирует
§4 в плоский набор перед вызовом движка. Проекция — §6.

---

## 2. Сущности и инвариант (по гл.05 §4)

| Сущность | Что | Ключевые поля |
|---|---|---|
| **Material** | вид материала (таксономия), о нём рассуждает ядро | `key` (join-ключ ядра), `base_unit`, `variability`, `default_sku_id` |
| **Sku** | конкретный продукт в конкретном магазине | `material_id`, `store_id`, `pack_size`, `pack_unit`, `coverage_per_pack?` |
| **Store** | вендор (Leroy / локальный) | `key`, `kind{chain,local,online}`, `priority_rank` |
| **Price** | наблюдение цены SKU, append-only | `amount_minor_units` (центы), `captured_at`, `source`, `is_estimate` |

**Инвариант пилота:** `Sku.pack_unit == Material.base_unit`. Модель **не несёт
conversion-факторов**, поэтому кросс-размерные SKU недопустимы; редкое исключение — через
`coverage_per_pack` (диапазон укрывистости, гл.05 §4). На пилоте `coverage_per_pack=null`
у всех 85 SKU — клей считается в kg (не в m²), затирка в kg и т.д., и пак продаётся в той же
единице. Проекция (§6) **бросает** на нарушении — лучше упасть на загрузке, чем тихо
ошибиться в округлении.

**9 материалов пилота** (= `MaterialKind` = ключи `NormRule`, гл.07):

| `key` | category | base_unit | variability | default-пик (Leroy, ориентир-цена) |
|---|---|---|---|---|
| floor-tile | tile | m² | ranged | Aleluia Studio Grey 45×45 — 22.70 € / коробка |
| wall-tile | tile | m² | ranged | Recer branco 30×60 retificado — 31.63 € / коробка |
| tile-adhesive | adhesive | kg | high_variance | SikaCeram 215 Flex C2TE 25 kg — 14.79 € |
| grout | grout | kg | ranged | Webercolor Premium 5 kg — 14.50 € |
| paint | paint | l | ranged | Robbialac Robbiplast NG 2-em-1 15 L — 49.90 € |
| primer | primer | l | ranged | Total Hydropliolite 3-em-1 5 L — 34.99 € |
| screed-mix | screed | kg | high_variance | Sikafloor-100 Level 25 kg — 19.00 € |
| waterproofing | waterproofing | kg | ranged | weber.dry 824 cinza 20 kg — 69.00 € |
| baseboard | trim | m | fixed | Artens MDF lacado branco 8 cm × 2.40 m — 11.98 € |

`variability` — интринсик-флаг D7 (числовой диапазон живёт в `NormRule`, гл.07): клей и
стяжка `high_variance` (расход = f(зубец / ровность основания), Risk #1).

---

## 3. Источник данных и курация

`leroymerlin.pt` отдаёт **403** ботам (бот-блок, подтверждено в гл.07) → **скрейпер не
строим** (D10: свежесть цены некритична). Источник курации:

1. **Фабричные fichas брендов, что Leroy PT возит:** Artens (own-brand Leroy), Weber, Mapei,
   Kerakoll, Sika, Bostik, CIN, Robbialac, Dyrup, Barbot, Topeca, Recer, Aleluia, Love Tiles,
   Margres, Grespania, Pavigrés. Дают реальные форматы, плотности, размеры упаковок.
2. **Вторичные PT-ритейлеры** для форматов/цен/наличия: Armazéns Reis, Macovex, Materialia,
   ASPereira и т.п. (там, где Leroy retail тонок).
3. **Ручная курация по реальным покупкам Давида** — главный якорь (§ ниже).

**Статус данных — честно:** продукты, бренды и размеры упаковок **реальные**; **цены —
ориентиры** (`is_estimate=true`, `source=manual_curator`, captured 2026-05-30). Каталог собран
по реальному ассортименту рынка Лиссабона, но **ещё НЕ по фактическим покупкам Давида** — на
момент написания пилот pre-concierge, его чеков/списка нет в репозитории.

**Как каталог затвердевает по факту Давида (concierge, гл.02 «Assignment», D6):**

| Сигнал от Давида | Куда ложится |
|---|---|
| чек на покупку | `Price` с `source=receipt`, `is_estimate=false` (калибровка цены) |
| «я беру вот это» | `Material.default_sku_id` → его пик; `Sku.active` |
| новый бренд/SKU | новая `Sku`-строка (+ `Price`) |
| позиция вне каталога | `ProcurementActual.sku_free_text` (off-catalog, формализуется позже) |

Валидация каталога = **«сходятся ли SKU/количества с реальной закупкой Давида»** (Risk #1,
гл.06), а не полнота теоретического списка.

---

## 4. Multi-store стратегия и решение Open Q2

**Зачем multi-store с дня 1** (D10, гл.05 §4): одного Leroy не хватает — расходятся
**наличие**, **локальная цена**, нужны **аналоги** и **pro-объём / toscos** (цемент, инертные,
сантехника по паллетам), которых retail-флор Leroy толком не держит.

**Решение Open Q2:** каталог покрывает **9 реальных магазинов** Лиссабона (priority-ranked).
`default_sku_id` каждого материала остаётся на **Leroy** (chain-якорь, in-stock) — прочие 8
дают сравнение цен, аналоги и наличие. Конкретный набор, которым реально пользуется Давид,
уточняется в concierge (его факт перебивает курацию).

| # | Магазин (`key`) | kind | Чем закрывает Leroy | SKU |
|---|---|---|---|---|
| 1 | Leroy Merlin PT (`leroy-pt`) | chain | якорь: широкий ассортимент, дефолты | 62 |
| 2 | Obramat Alfragide (`obramat`) | chain | pro-склад Adeo (ex-Bricomart): toscos по паллетам, betonilha/цемент, pro-сантехника, bulk, grua, trade-кредит | 13 |
| 3 | Maxmat (`maxmat`) | chain | cash&carry: дешёвые staples, own-brand аналоги (cola/cimento Maxmat), пригород | 10 |
| 4 | Brico Depôt Loures (`brico-depot`) | chain | Kingfisher hard-discount: бенчмарк низа цены, stock-led | 9 |
| 5 | Armazéns Reis (`armazens-reis`) | chain | materiais de construção: глубина плитки/azulejo + эпокси-затирки | 15 |
| 6 | Aleluia (`aleluia`) | local | шоурум фабрики: плитка, единый тон/партия | 8 |
| 7 | Coriprel (`coriprel`) | local | tintas & ferragens: pro-краски/грунты (Robbialac/CIN/Dyrup), Sika, колеровка | 12 |
| 8 | BigMat Loures (`bigmat`) | local | соседские toscos: betonilha/цемент, базовый клей/гидро | 6 |
| 9 | Bricomarché Arco do Cego (`bricomarche`) | chain | urban-формат в центре: мелкие банки/мешки, same-day | 6 |

⚠️ **`AKI` = `Leroy Merlin`** (слияние объявлено 2019, магазины конвертированы к ~2021) —
**не считать отдельным магазином** (одна и та же сеть/каталог).

**Сравнение цен — суть multi-store:** часть популярных продуктов лежит в 2–4 магазинах с разной
ориентир-ценой (напр. плитка Aleluia Studio 45×45: Leroy 22.70 / Armazéns Reis 23.90 / Aleluia
24.90 / Maxmat 21.50 €/коробка; betonilha 25 кг: Brico Depôt 4.59 / BigMat 5.30 / Maxmat 5.49 /
Obramat 5.60). Дешёвый край держат дискаунт/cash&carry (Brico Depôt, Maxmat), премиум/специалист
— шоурум и drogaria.

**Стоимость курации:** каждый магазин × материал = новые `Sku`+`Price`-строки, все — **ориентиры**
(D10, свежесть некритична). Магазины добавлены под **реальные пробелы** (toscos/bulk, дискаунт,
плитка-специалист, краски), а не для полноты; глубину наполняем по факту Давида. Промоушн
generic→named прошли без миграции данных (`Store.key` стабилен).

**Out-of-stock на пилоте** = `Sku.active` toggle или ручной выбор другого Sku.
`Substitute`/`Availability` авто-резолвер — deferred (гл.05 §4; триггер — частый out-of-stock
/ scraper).

---

## 5. Формат seed-данных

Файл `compute-core/src/catalog/seed.json`, форма `CatalogSeed` (`compute-core/src/catalog/
seed-types.ts` — зеркало гл.05 §4):

```jsonc
{
  "catalog_version": "2026.05.30-seed-v1",
  "stores":    [ { "id": "store-leroy-pt", "key": "leroy-pt", "kind": "chain", "priority_rank": 1, ... } ],
  "materials": [ { "id": "mat-floor-tile", "key": "floor-tile", "base_unit": "m2",
                   "variability": "ranged", "default_sku_id": "sku-aleluia-studio-grey-45x45", ... } ],
  "skus":      [ { "id": "sku-...", "material_id": "mat-...", "store_id": "store-...",
                   "pack_size": 1.42, "pack_unit": "m2", "coverage_per_pack": null, ... } ],
  "prices":    [ { "id": "price-...", "sku_id": "sku-...", "amount_minor_units": 2270,
                   "currency": "EUR", "captured_at": "2026-05-30T00:00:00Z",
                   "source": "manual_curator", "is_estimate": true } ]
}
```

Принципы формата:

- **Все строки GLOBAL** (`org_id=null`, гл.05 §4) и логически несут `catalog_version`.
- **ID — стабильные читаемые slug** (`store-leroy-pt`, `mat-floor-tile`, `sku-…`, `price-…`),
  не UUID: курируемый вручную seed выигрывает от **диффабельности** и явных ссылок
  (`default_sku_id`). Прод-загрузчик может перемайнтить в UUIDv7 (гл.05 §0); slug остаётся
  natural-key.
- **Деньги — integer minor units (центы):** без f64-drift на serde/WASM-границе (D10).
  per-base-unit = `amount_minor_units / pack_size`.
- **Price append-only:** `captured_at` + `source` + `is_estimate`; `current = max(captured_at)`
  per Sku. 3 SKU несут вторую строку (`2026-02-01`) — демонстрация истории.
- **Загрузка:** read-only seed в сервер → pull/bundle в IndexedDB (гл.05 §9). Клиент почти не
  пишет; глобальное пишет только curator-роль.

**Текущий состав seed** (`catalog_version=2026.05.30-seed-v2`; счётчики и диапазоны
ориентир-цен за упаковку по всем 9 магазинам):

| Материал | SKU | EUR / упаковку |
|---|---|---|
| floor-tile (m²/коробка) | 17 | 8.99 – 50.40 |
| wall-tile (m²/коробка) | 13 | 6.99 – 38.00 |
| tile-adhesive (kg/мешок) | 19 | 3.49 – 32.49 |
| grout (kg/мешок) | 14 | 4.90 – 62.00 |
| paint (l/банка) | 19 | 5.99 – 139.00 |
| primer (l/банка) | 14 | 9.90 – 135.00 |
| screed-mix (kg/мешок) | 17 | 4.59 – 33.00 |
| waterproofing (kg/мешок) | 15 | 22.00 – 105.00 |
| baseboard (m/хлыст) | 13 | 2.99 – 39.95 |
| **Итого** | **141** | — |

Распределение по магазинам: `leroy-pt` 62 · `armazens-reis` 15 · `obramat` 13 · `coriprel` 12 ·
`maxmat` 10 · `brico-depot` 9 · `aleluia` 8 · `bigmat` 6 · `bricomarche` 6.

---

## 6. Проекция в движок

Гл.05 §8: ядро не хранит каталог — app проецирует §4 в плоский набор. Реализация —
`compute-core/src/catalog/project-seed.ts`:

```
projectCatalog(seed): Record<MaterialKind, Sku>
  для каждого активного Material:
    взять Sku по default_sku_id  (проверить, что он того же материала)
    проверить ИНВАРИАНТ pack_unit == base_unit (иначе throw)
    взять текущую цену = max(captured_at)
    → { packSize, packUnit, priceEur = amount_minor_units/100, store }
```

- Движок получает **один default-пик на материал**; полный multi-SKU/multi-store seed живёт
  для app-UI (SKU-picker, сравнение цен, будущий резолвер).
- Проекция **заменила прежнюю `SAMPLE_CATALOG`-заглушку** (`sample-catalog.ts` теперь
  re-export `CATALOG`). Исправлен баг заглушки: мешок клея был 25 kg на все — теперь реальные
  20/25 kg по продукту; цены — реальные ориентиры вместо круглых чисел.
- Экспорт из `compute-core`: `CATALOG`, `SEED`, `projectCatalog`, `currentPriceFor` +
  типы `CatalogSeed/Store/Material/Sku/Price`.

---

## 7. Процесс обновления цен-ориентиров

Цена — **append-only наблюдение** (D10, гл.05 §4 Price): новое значение = **новая строка**, не
мутация. Это держит историю и делает price-drift атрибутируемым отдельно от norm-error
(гл.05 §5 `PurchaseSnapshot.catalog_version`).

**Trust-порядок источников** (`Price.source`):
`receipt` (чек Давида — калибровка цены) > `store_website` / `scraper` > `foreman_report` >
`manual_curator` (seed-ориентир). Чек Давида также живёт на факте как
`ProcurementActual.actual_price_minor_units` — точность цены калибруется **отдельно** от
точности норм.

**Ритм:** свежесть некритична (D10) → ре-курация **руками перед объектом** или ~квартально;
`current = max(captured_at)`; при значимом обновлении — bump `catalog_version`. Скрейпер не
нужен долго; если появится — `source=scraper`, та же append-модель, без изменения схемы.

---

## 8. Поддержка и расширение

- **Добавить SKU:** новая `Sku`-строка (+ ≥1 `Price`), `pack_unit == base_unit`.
  Активировать/деактивировать = `active` toggle (это курация, **≠ availability**).
- **Новый Material:** требует **нормы в гл.07** (`NormRule`) и расширения `MaterialKind` enum
  (контракт ядра) — это **код + норма**, не только каталог. Поэтому материалы расширяем только
  под реальную регулярную потребность Давида.
- **Длинный хвост расходников** (крестики/СВП, силикон, профили-окантовка, сетка-серпянка,
  дюбели) — **не отдельные Material** (норм нет): идут через off-catalog `sku_free_text` на
  факте; формализуются в `Material` только если станут регулярными и получат норму.

---

## 9. Валидация и инварианты (тесты)

`compute-core/test/catalog.test.ts` (часть из 17 тестов пакета) проверяет на каждой загрузке:

- `catalog_version` присутствует; `id` уникальны внутри каждой сущности;
- ровно **9 материалов** пилота, все active, у каждого `default_sku_id`;
- **ссылочная целостность**: `sku.material_id` / `sku.store_id` / `price.sku_id` резолвятся;
- `default_sku_id` резолвится в SKU **того же** материала;
- **ИНВАРИАНТ ПИЛОТА** `pack_unit == base_unit` (или есть `coverage_per_pack`);
- у каждого SKU ≥1 цена; цены — **integer money, sourced, `is_estimate=true`** (D10);
- размер каталога **50..100 SKU**; оба магазина присутствуют и непусты;
- **проекция** покрывает все 9 видов валидными SKU движка; интеграция с пайплайном даёт
  ненулевой лист.

**Гейты:** `node --test` (17/17), `tsc --noEmit` (0 ошибок).

Чего тесты **не** проверяют: **точность цен** и **точность норм** — это снимается на реальном
объекте Давида (Risk #1, D5), а не в схеме.

---

## 10. Ограничения / честный статус

- **Цены — ориентиры, не валидированы** (D10). В UI помечать «уточни в магазине»; не
  показывать как точную фичу.
- Каталог **best-effort** по реальным Leroy-PT / Lisbon продуктам, но **не по фактическим
  покупкам Давида** (их ещё нет — pre-concierge). Якорь валидации = concierge (гл.11).
- Набор из **9 магазинов** курируется по реальному ландшафту Лиссабона; **какими Давид реально
  пользуется** — уточнить в concierge (набор может сократиться). Цены не-Leroy особенно
  ориентировочны (часть own-brand/дискаунт — категорийные плейсхолдеры без конкретной страницы).
- Каталог **неполон by design** → off-catalog путь обязателен.

---

**Связки:** D10 (цена-ориентир) · гл.05 §4 (схема каталога) · §8 (проекция в ядро) · §9
(local vs сервер) · §10 (insert-only Price, trust boundary) · гл.07 (нормы, `base_unit`) ·
гл.06 Risk #1 / Open Q2 · гл.11 (concierge-валидация).
