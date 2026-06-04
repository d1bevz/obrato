# Obrato · compute-core (Rust)

Продуктовое ядро (слайс 0, гл.11): модель ввода → формулы гл.07 →
количества-диапазоны с confidence (контракт гл.05 §8). Чистый модуль,
ноль зависимостей сверх std. Фасовки/лист закупок — слайс 1; WASM — слайс 3.

## Запуск

```bash
cargo test           # нужен системный линкер cc (apt install gcc)
```

Без gcc (VPS): musl-таргет с бандленным rust-lld:

```bash
rustup target add x86_64-unknown-linux-musl
RUSTLLD=~/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/bin/rust-lld \
CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER=$RUSTLLD \
cargo test --target x86_64-unknown-linux-musl
```

## Структура

| Модуль | Что |
|---|---|
| `model.rs` | Вход: Room (+wet_zone_height), Works c floor_finish, Opening (door/window/passage) |
| `norms.rs` | NormValue {central, lo, hi, confidence}, NormAssumptions (структурные, гл.05 §3) |
| `formulas.rs` | Формулы гл.07: клей (зуб/профиль), затирка (A×B×C×D×k), гидра (DFT), краска (rendimento), ровнитель/betonilha |
| `geometry.rs` | Площади, периметр, площадь гидры = пол + периметр × заход |
| `engine.rs` | Композиция диапазонов (гл.05 §8), ветвление работ (гл.08 §3.2-3.3) → MaterialEstimate |
| `materials.rs` | 10 материалов (ключи = каталог), 8 этапов (гл.05 §5) |

## Приёмка

- `tests/formulas_ch07.rs` — каждая формула против опорных чисел гл.07
  (verify-правки §4: k=1.6, autonivelante 1.6, U-зуб /3).
- `tests/flatplan_golden.rs` — квартира 53.7 м² из реального дизайн-проекта
  (docs/reference/flatplan-1001_527/): площади ±3% к экспликации, плиточные
  полы 15.7 м², стены ванной 19.7 м², плинтус 34.7 м (f5), гидра = пол + заход.

TS-прототип в `compute-core/` (корень репо) — замороженный референс, не продукт.
