# Obrato: AI-помощник прораба

**Статус:** отполированный draft, 2026-05-29
**Проект:** Obrato, мобильный помощник прораба для закупочного планирования
**Главное решение:** валидировать узкий wedge на реальных объектах, прежде чем строить полноценное Android-приложение.

## Executive Summary

Obrato не должен начинаться как еще один широкий construction-management продукт.
Правильный старт — **закупочный планировщик для прораба на ремонте**:

1. Прораб замеряет помещение лазерным дальномером и вводит размеры.
2. Obrato превращает размеры и выбранный состав работ в проверяемые количества.
3. Прораб выбирает конкретные материалы или использует дефолтный набор.
4. Obrato округляет количества до реальных упаковок, связывает их с локальными
   поставщиками и группирует закупку по этапам работ.
5. Приложение заранее напоминает, что скоро этап упрется в отсутствующий материал.

Это должен быть **AI-assisted**, а не **AI-magical** продукт. Количества, округления,
чертежи и этапы должны быть детерминированными и объяснимыми. AI полезен для intake,
очистки вводных, supplier matching, объяснений и обработки исключений; он не должен быть
источником истины по замерам и количествам.

Самый сильный следующий шаг — все еще не код. Нужно взять один реальный объект Давида
и руками сделать ровно тот артефакт, который приложение позже будет генерировать:
замеры, состав работ, формулы, pack rounding, ссылки на товары, цены, наличие, замены,
этапы закупки и сверку с фактической покупкой/расходом.

## Decision Frame

**Решение сейчас:** продолжать validation через concierge-пилот, а не начинать сразу
полный mobile build.

**Evidence bar для первой версии приложения:**

- минимум 3 реальных объекта, а не один разговор;
- Давид или другой прораб дает реальные замеры и состав работ;
- закупочный лист готовится до начала соответствующих работ;
- прораб реально использует лист для закупки или сверки;
- расчетные количества попадают в приемлемый для прораба запас;
- хотя бы один прораб платит, делает prepay или явно соглашается на платный следующий
  объект.

**Что поменяет рекомендацию:** если реальные объекты покажут, что прорабы уже решают это
достаточно хорошо через поставщика, WhatsApp, память и запас; если точность требует слишком
много вводных; или если локальные цены/наличие нельзя поддерживать достаточно свежими.

## Problem

Прорабы и малые ремонтные бригады теряют деньги, когда нужного материала нет в нужный
момент.

Механизм простой:

нет материала -> срочная поездка / ожидание -> простой людей -> сдвиг графика ->
невозможность вовремя взять или начать следующий заказ.

Давид оценил стоимость такого простоя примерно в **1000 EUR/день**. Это сильное
качественное свидетельство от одного клиента, но пока не доказательство рынка.

Корень проблемы не только в смете. Это операционное планирование под давлением:

- прораб находится на объекте и утопает в текущих задачах;
- закупки часто планируются реактивно;
- по ходу работ меняются фактические условия;
- наличие и замены локальны, а не абстрактны;
- существующие инструменты слишком широкие, офисные или ручные.

Задача Obrato — превратить замеры и намерение по работам в закупочную последовательность
до того, как объект остановится.

## Target User

**Первичный пользователь:** прораб / бригадир / малый renovation contractor /
encarregado de obra.

**Начальный persona:** Давид и похожие операторы в Лиссабоне, Cascais, Porto и рядом:

- малая команда или сеть субподрядчиков;
- Android-телефон на объекте;
- лазерный дальномер уже используется для замеров;
- закупки в Leroy Merlin Portugal и локальных магазинах;
- типовые работы: квартиры, санузлы, кухни, полы, покраска, плитка, базовая электрика;
- стоимость задержек ощущается лично.

**Не первичный пользователь:**

- конечный владелец квартиры;
- дизайнер интерьера;
- архитектор;
- крупный генподрядчик с отделом закупок;
- DIY homeowner.

## Positioning

Obrato — не дизайн-генератор и не BIM.

**One-liner:** Obrato превращает замеры ремонта в покупаемый, поэтапный список материалов
для прораба.

**Сильное обещание:** меньше материальных сюрпризов на объекте.

**Анти-обещание:** никаких photorealistic renders, автоматического вкуса, full BIM или
заявления, что AI по паре фотографий поймет реальные строительные условия.

## Market Snapshot

Широкий рынок достаточно большой; вопрос в reachable wedge.

Быстрый public scan показывает, что в Португалии есть значимая база малых строительных
операторов:

- Statista summaries указывают на **58k+ construction companies** и примерно
  **342k private-sector construction workers** в Portugal.
- Statista также указывает, что почти **87% construction enterprises** в Portugal —
  micro-enterprises.
- EU construction-sector material сообщал **94,452 narrow-construction firms** в 2020
  внутри **174,298 broad construction-sector enterprises**.

Эти цифры подтверждают наличие рынка, но не доказывают спрос на Obrato. Для этой идеи
поведение клиентов важнее TAM-цифр.

Реальный первый wedge:

> малые ремонтные команды в Lisbon/Cascais/Porto, которые покупают материалы в
> Leroy/local suppliers и не имеют отдельного estimator/procurement person.

Wedge привлекательный, потому что боль локальная, повторяемая и плохо закрыта enterprise
software. Он рискованный, потому что малые подрядчики часто ненавидят process-heavy tools
и предпочитают память, WhatsApp, поставщика и покупку с запасом.

## Competitive Landscape

Конкуренцию нужно смотреть по customer choice, а не только по похожим названиям.

### Status Quo

Главный конкурент — текущий ручной workflow:

- тетрадь, WhatsApp, звонки, фото, память;
- советы продавца/поставщика;
- ad hoc spreadsheets;
- покупка с запасом;
- срочные поездки в магазин.

Obrato выигрывает только если он быстрее и надежнее этого неформального процесса.

### Construction Calculator Apps

В Google Play и App Store уже много строительных калькуляторов. Обычно они решают
отдельные формулы: paint, tile, concrete, drywall, flooring, framing, объемы,
unit conversion, иногда простой shopping list.

Это хорошие UX-reference по простоте, но слабый прямой конкурент, если Obrato владеет
локальным procurement layer: реальные упаковки, store links, stock, substitutions, stages
и reminders.

### Takeoff / Estimating Suites

PlanSwift, Buildxact, MeasureSquare, Bluebeam, Autodesk Construction Cloud, Procore и
похожие продукты закрывают digital takeoff, estimating, bid management, project management
или trade-specific measurement.

Они доказывают категорию, но показывают и свободную нишу: многие продукты office-oriented,
plan/PDF-first, широкие, дорогие или рассчитаны на builders/estimators, а не на малого
прораба, который вводит размеры на телефоне стоя на объекте.

### Material Procurement Platforms

Field Materials и похожие платформы фокусируются на заказах, approvals, packing slips,
vendor messaging и закупках against existing estimates/buyouts.

Это близко к будущему состоянию, но не первый wedge. Obrato сначала должен создавать
estimate/purchase list из простых jobsite measurements; procurement workflow можно
достраивать позже.

### Measurement / Scan Apps

Magicplan, HOVER и похожие продукты помогают с room capture, property photos, планами,
estimates или takeoffs.

Они важны как ориентир по снижению input friction. Но Obrato не должен начинать с полного
scan vision. Ручные лазерные замеры проще, дешевле и надежнее для первого trust loop.

### Local Suppliers

Leroy Merlin Portugal уже дает consumer app с продуктами, online purchase и store stock
checks. Другие локальные поставщики и marketplaces существуют, но покрытие и доступность
данных будут неровными.

Это одновременно opportunity и risk. Если Obrato надежно мапит количества в локальные SKU
и наличие, он становится полезным. Если данные устарели или ломаются, доверие быстро
исчезает.

## Differentiation

Защитный слой — не "AI" и не canvas. Это локальный перевод "что делаем в комнате" в
реальные закупочные решения:

- schema замеров, которую прораб реально заполнит;
- formulas/assumptions по типовым work packages;
- pack-size rounding и waste rules;
- локальный SKU-каталог для Portugal;
- supplier availability, substitutions и аналоги;
- закупка по этапам;
- reminders до блокирующего этапа;
- calibration against real jobs.

Иными словами: Obrato должен стать local operating system for renovation procurement.
Ценность появится только если он достаточно точный, чтобы ему верили, и достаточно быстрый,
чтобы им пользовались.

## Product Contract

### Inputs

- Object: название объекта, location, supplier preference.
- Rooms: тип, длина, ширина, высота, openings, wet zones.
- Work packages: floor, tile, paint, plaster/drywall, ceiling, basic electrical points,
  waterproofing, rough plumbing placeholders.
- Material preferences: выбранные SKU или defaults по quality band.
- Job stages: default sequence with manual overrides.

### Outputs

- 2D room plan и простые elevations там, где они помогают проверить расчет.
- Quantities with formulas and visible assumptions.
- Pack-rounded purchase lines.
- Staged shopping list: supplier, SKU, price, stock note, link, substitute.
- Warnings for low-confidence lines.
- Export/share: PDF, CSV, WhatsApp-friendly text.
- Reminders before each stage needs materials.

### Trust Requirements

Каждая строка закупки должна отвечать:

- почему такое количество;
- какой замер его породил;
- какой waste/rounding применен;
- какая упаковка выбрана;
- на каком этапе это нужно;
- строка exact, estimated или manually overridden.

Если прораб не может проверить расчет, он не доверит списку реальный объект.

## AI Role

AI должен помогать вокруг deterministic core:

- превращать rough notes или voice input в structured work packages;
- замечать пропущенные вводные и задавать короткие вопросы;
- объяснять расчеты нормальным языком;
- мапить generic material names в candidate SKUs;
- предлагать substitutions, если stock missing;
- собирать WhatsApp/PDF summary;
- сравнивать план с фактическими покупками после объекта.

AI не должен:

- придумывать quantities;
- выводить hidden site conditions;
- молча выбирать профессиональные assumptions;
- генерировать финальные technical drawings без deterministic geometry;
- скрывать uncertainty.

## MVP Strategy

### MVP 0: Concierge Pilot

Пока без приложения. Взять один реальный объект Давида и руками сделать полный purchase
plan.

Deliverable:

- structured measurements and work packages;
- material rules line by line;
- staged purchase list with Leroy/local supplier links;
- pack rounding;
- price and stock snapshot;
- substitution notes;
- comparison against actual purchases and usage.

Цель — не сэкономить development time. Цель — собрать правду, без которой нельзя строить
движок.

### MVP 1: Android Prototype

Строить только после того, как concierge data подтвердит flow.

Scope:

1. Один объект с несколькими прямоугольными комнатами.
2. Manual room dimensions and openings.
3. Work packages: paint, floor, wet-zone tile, waterproofing, basic electrical points.
4. Simple deterministic 2D plans/elevations.
5. Formula-based quantities with visible assumptions.
6. Pack rounding for first curated material categories.
7. Small curated Leroy Portugal catalog, initially manually refreshed.
8. Staged purchase list, export, reminders.

Out of scope:

- photorealistic renders;
- automatic design generation;
- Bluetooth laser integration;
- non-rectangular geometry;
- professional tile-layout solver;
- full cable-route calculation;
- multi-user/team workflow;
- automatic purchasing;
- broad supplier marketplace.

## First Work Packages

Начинать нужно с work packages, где замеры и формулы tractable, а output мапится в
повторяемые SKU.

**Paint:** wall/ceiling area, openings, coats, primer, coverage, can sizes.

**Flooring:** room area, waste coefficient, underlay, baseboards, thresholds, pack sizes.

**Wet-zone tile:** wall/floor areas, tile size, simple waste, adhesive, grout,
waterproofing. Чертеж может показывать rough grid, но должен быть явно помечен как rough
layout, пока нет настоящего tile-layout solver.

**Basic electrical points:** outlets, switches, light points, box counts, visible point
placement. Cable routing — не MVP.

**Waterproofing:** area-based materials for bathrooms/wet zones, assumptions visible.

Plumbing detail лучше не включать в первую app-версию, пока пилот с Давидом не покажет
повторяемый простой паттерн. Plumbing быстро становится сложным.

## Data Model Sketch

Первую реализацию можно держать простой, но понятия должны быть разделены:

- **Project:** location, supplier preferences, stages.
- **Room:** type, dimensions, openings, wet zones.
- **WorkPackage:** selected task and parameters.
- **MaterialRule:** deterministic formula, inputs, waste, rounding.
- **MaterialItem:** generic material need, unit, quantity.
- **SKU:** supplier item, pack size, unit price, stock snapshot, source URL.
- **PurchaseLine:** SKU + rounded quantity + stage + confidence + notes.
- **Override:** human change with reason.

Ключевая архитектурная граница: generic quantity calculation отдельно от supplier SKU
mapping. Формулы должны тестироваться без live supplier data.

## UX Principles

- **Fast on site:** минимум вводных до первого полезного списка.
- **One screen per decision:** room, work package, material choice, purchase list.
- **Defaults with overrides:** прораб должен править assumptions без борьбы с app.
- **Show uncertainty:** low-confidence lines нужно помечать, а не имитировать точность.
- **Offline-first entry:** замеры должны работать без стабильной сети.
- **Portuguese-first UI:** RU/EN полезны для founder workflow, но рынок требует PT.
- **Shareable output:** WhatsApp and PDF важнее красивого dashboard.

## Technical Notes

**Platform:** Android остается правильной первой платформой: начальный пользователь на
Android и работает на объекте.

**Framework decision:** не выбирать Kotlin vs Flutter по вкусу. Сделать one-day prototype
для:

- measurement form speed;
- canvas/SVG room plan;
- PDF/share export;
- offline local storage;
- Android APK distribution.

Flutter может быть прагматичнее для solo-разработки с heavy custom drawing. Kotlin может
оказаться лучше, если native Android integration станет центральной. Решение должен принять
прототип.

**Supplier data:** считать, что стабильного публичного Leroy API нет, пока не доказано
обратное. Начинать с маленького curated catalog и ручного refresh для пилотов. Позже
проверить scraping, third-party scraper APIs, direct supplier relationships или
affiliate/partner feeds.

**Liability:** не использовать формулировки, похожие на инженерную сертификацию. Obrato
делает procurement planning estimates for renovation materials, а не legally binding
technical design или code-compliance documents.

## Risks

### 1. Demand Still N=1

Боль Давида сильная, но это один прораб. Следующее доказательство — не еще одно мнение, а
repeated use on real jobs, willingness to pay и intros to similar foremen.

Mitigation: три concierge jobs + пять интервью с non-friend foremen до build beyond
prototype.

### 2. Accuracy May Require Too Many Inputs

Часть формул требует скрытых site variables:

- tile waste зависит от размера плитки, pattern, datum, openings и installer practice;
- adhesive зависит от tile size and trowel notch;
- self-leveling compound зависит от unevenness основания;
- paint зависит от coats, absorption, surface condition;
- grout зависит от tile size, joint width, thickness.

Mitigation: начинать с формул, где assumptions visible and overridable. Сравнивать план с
фактической закупкой и остатками Давида.

### 3. Supplier Data Can Break Trust

Цены, наличие, pack sizes и substitutions меняются. Stale material list хуже, чем никакого
списка, если прораб на него положился.

Mitigation: curated catalog first, timestamp every stock/price snapshot, stale data visible,
manual supplier switch.

### 4. App May Be Too Much Work

Если setup занимает дольше текущего informal process, adoption умрет.

Mitigation: optimize for first useful purchase list, not complete project modeling. Voice
and photo intake can be AI-assisted later; первая версия должна работать через простые
forms.

### 5. Tile Layout and Electrical Routing Are Scope Traps

Professional tile balancing и electrical cable routes — это реальные solvers, а не маленькие
UI features.

Mitigation: MVP shows rough visuals and point placement only. Solver work moves to phase 2
after procurement value is proven.

### 6. Local Market May Prefer Supplier-Led Planning

Некоторые прорабы могут полагаться на продавцов/поставщиков для quantity checks and
substitutions.

Mitigation: проверить напрямую в интервью: "Who checked your last material list? What did
they miss? Would you trust an app before the supplier?"

## Validation Plan

### Concierge Job Protocol

Для каждого объекта фиксировать:

- room measurements and openings;
- selected work packages;
- assumptions for each material rule;
- generated quantity;
- rounded pack quantity;
- chosen SKU/supplier;
- stock and price timestamp;
- what David actually bought;
- what ran short, what was returned, what was left over;
- whether a material shortage caused delay;
- time spent creating the list;
- whether David would pay for the same output next time.

### Customer Interview Questions

Спрашивать про прошлое поведение, а не hypothetical interest:

1. Tell me about the last job where materials delayed work.
2. What was missing, and when did you discover it?
3. Who was idle, for how long, and what did it cost?
4. How did you make the original material list?
5. Who checked it?
6. What did you overbuy to protect yourself?
7. Which supplier did you use and why?
8. What would make you trust or reject an app-generated list?
9. What would this have to save for you to pay monthly?
10. Can we build the next material list with you and compare it to reality?

### Success Metrics

Pilot success:

- three real jobs processed;
- less than 30 minutes to produce usable first purchase list after measurements;
- foreman uses the list for actual buying;
- quantity variance stays inside foreman's acceptable reserve range for core materials;
- at least one avoided shortage or materially faster purchase flow;
- at least one paid pilot or explicit paid next job.

Kill or pause criteria:

- foremen refuse structured measurement entry;
- actual quantity variance is too high without adding many inputs;
- supplier stock/price data cannot be made trustworthy enough;
- David likes the idea but does not use output on a real job;
- non-friend foremen do not describe the same pain.

## Pricing Hypothesis

Не ставить pricing от broad SaaS competitors. Цена должна проверяться против avoided delay.

Starting hypotheses:

- **Single foreman:** 49-99 EUR/month, если app reliably prevents even one emergency
  material problem per month.
- **Per project:** 15-30 EUR per generated purchase plan for low-frequency users.
- **Concierge pilot:** charge per object after the first free validation job proves value.
- **B2B/company:** later, per crew or per active project with reporting and shared catalog.

Willingness to pay стоит проверять только после показа реального purchase list.

## Roadmap

### Now: Validation

- Run one David object manually.
- Interview five more foremen or small contractors.
- Confirm supplier workflow around Leroy and local stores.
- Check brand/domain/Google Play/trademark basics.

### Prototype

- Build measurement intake.
- Build deterministic quantity rules for 3-5 work packages.
- Build simple 2D visual confirmation.
- Build curated SKU catalog and staged purchase list.
- Export PDF/CSV/WhatsApp text.

### Product V1

- Add saved projects and templates.
- Add reminders and manual progress updates.
- Add supplier substitutions.
- Add calibration feedback from actual purchases.
- Add Portuguese UX polish.

### Later

- Bluetooth laser integration.
- More geometry.
- Tile-layout solver.
- Electrical routing.
- Multi-user crew/company mode.
- Direct supplier relationships or ordering.

## Open Questions

1. Какой конкретный первый объект Давид готов дать для concierge pilot?
2. Какие 5 material categories чаще всего вызывают painful shortages?
3. Давид покупает в основном в Leroy, у локальных поставщиков или гибридно?
4. Какой формат ему нужен на объекте: app screen, PDF, WhatsApp, printed list?
5. Какой reserve percentage он считает нормальным по типам материалов?
6. Сколько времени он готов тратить на ввод замеров?
7. Ему ближе pay per project, subscription или payment after saved delay?
8. Какие PT-термины использовать для work packages и роли прораба?

## Immediate Next Step

На этой неделе провести один реальный объект в concierge mode.

Output: spreadsheet или markdown report с:

- measurements;
- selected work packages;
- formulas and assumptions;
- quantities;
- pack-rounded purchase list;
- supplier links;
- price/stock timestamp;
- staged buying order;
- substitutions;
- after-action comparison with actual usage.

Только после этого решать, строить ли Android prototype.

## Brand Notes

Obrato — короткое coined name вокруг *obra* ("стройка/работа" на Portuguese). Название
можно держать, если базовые проверки пройдены, но не стоит переобъяснять этимологию:
это бренд, а не настоящее Portuguese-слово.

First scan:

- "Obra" и многие "Obra..." names crowded.
- "ObraTask" существует в construction site observations.
- "ObraTrack" найден как construction tracking app.
- Прямой collision "Obrato" в construction software quick scan не показал, но это не
  trademark search.

Required checks before public launch:

- domain: obrato.com / obrato.app / obrato.pt;
- Google Play exact-name availability;
- Instagram/X/LinkedIn handles;
- INPI Portugal and EUIPO trademark search for classes 9 and 42;
- possible confusion with nearby names: ObraTask, ObraTrack, Orato, Oberto.

## Source Notes

Memo основан на:

- original office-hours notes from 2026-05-29;
- текущем README и initial design draft;
- quick public web scan по construction calculators, takeoff/estimating suites,
  procurement platforms and Leroy Merlin Portugal;
- public market snippets from Statista, EU construction-sector material, FIEC and
  competitor/product pages.

Useful references for deeper follow-up:

- PlanSwift: https://www.planswift.com/
- Buildxact: https://www.buildxact.com/
- Field Materials: https://www.fieldmaterials.com/
- Magicplan: https://www.magicplan.app/
- HOVER takeoffs: https://hover.to/construction-takeoffs
- Leroy Merlin Portugal app listing: https://apps.apple.com/pt/app/leroy-merlin/id370400343
- EU Construction Sector Observatory Portugal profile:
  https://single-market-economy.ec.europa.eu/document/download/912ca050-cec6-4f43-9931-ffad7f9a124f_en

Evidence quality: direct David evidence is strong but narrow; public market/competitor data
is directional; only real foreman behavior on real jobs should unlock build confidence.
