// Протокол main ↔ worker (Граница A, гл.09 §2): управляющие метаданные
// барьера поток↔поток — requestId для supersede, status для обработки сбоя
// ядра. Доменные типы едут из Rust (crates/compute-wasm, tsify).

import type {
  CatalogInput,
  ComputeProjectResponse,
  ProjectInput,
} from 'compute-wasm';

export interface ComputeRequest {
  requestId: number;
  project: ProjectInput;
  catalog: CatalogInput;
}

export type ComputeResponse =
  | { requestId: number; status: 'ok'; response: ComputeProjectResponse }
  | { requestId: number; status: 'error' | 'panic'; message: string };
