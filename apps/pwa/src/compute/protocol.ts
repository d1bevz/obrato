// Протокол main ↔ worker (Граница A, гл.09 §2): управляющие метаданные
// барьера поток↔поток — requestId для supersede, status для обработки сбоя
// ядра. Доменные типы едут из Rust (crates/compute-wasm, tsify).

import type {
  CatalogInput,
  ComputeProjectResponse,
  DrawingGeometry,
  ProjectInput,
} from 'compute-wasm';

export type ComputeRequest =
  | {
      requestId: number;
      kind: 'project';
      project: ProjectInput;
      catalog: CatalogInput;
    }
  | {
      requestId: number;
      kind: 'grid';
      roomLengthM: number;
      roomWidthM: number;
      tileWM: number;
      tileHM: number;
    };

export type ComputeResponse =
  | { requestId: number; status: 'ok'; response: ComputeProjectResponse }
  | {
      requestId: number;
      status: 'ok-grid';
      /** null — вырожденная геометрия (ядро отказалось строить сетку). */
      response: DrawingGeometry | null;
    }
  | { requestId: number; status: 'error' | 'panic'; message: string };
