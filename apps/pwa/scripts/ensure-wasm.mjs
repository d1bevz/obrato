// predev-страховка: pkg/ ядра gitignored — на чистом клоне без сборки wasm
// dev-сервер падал бы на неразрешимом 'compute-wasm'. Если pkg нет — собираем
// (нужны rustup target wasm32 + wasm-pack); если есть — не трогаем
// (dev-loop гл.09 §5: wasm пересобирается только при смене контракта).
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = fileURLToPath(
  new URL('../../../crates/compute-wasm/pkg/compute_wasm.js', import.meta.url),
);

if (!existsSync(pkg)) {
  console.log('[ensure-wasm] crates/compute-wasm/pkg отсутствует — собираю…');
  execSync('npm run build:wasm', { stdio: 'inherit' });
}
