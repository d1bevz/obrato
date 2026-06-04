// Протокол main ↔ worker (Граница A, гл.09 §2): управляющие метаданные
// барьера поток↔поток — requestId для supersede, status для обработки сбоя
// ядра. Доменные типы едут из Rust (crates/compute-wasm, tsify).

import type { EstimateResponse, ProjectInput } from 'compute-wasm';

export interface ComputeRequest {
  requestId: number;
  project: ProjectInput;
}

export type ComputeResponse =
  | { requestId: number; status: 'ok'; response: EstimateResponse }
  | { requestId: number; status: 'error' | 'panic'; message: string };
