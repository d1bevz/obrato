// Прежняя ЗАГЛУШКА-каталог заменена курируемым каталогом ~50-100 SKU (Leroy PT +
// локальный), который грузится из seed.json и проецируется в каталог движка
// (см. project-seed.ts + docs/design/10-catalog.md).
//
// Имя SAMPLE_CATALOG сохранено как back-compat алиас (его импортируют index.ts и
// тесты). DEPRECATED: используйте CATALOG из './project-seed.ts'.
export { CATALOG as SAMPLE_CATALOG } from './project-seed.ts';
