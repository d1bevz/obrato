/// <reference lib="webworker" />
// Worker Границы A: грузит WASM-ядро и считает оценки вне главного потока.
// Panic-safety (гл.09 §2): паника Rust всплывает как WebAssembly.RuntimeError —
// ловим и отдаём status:'panic' наружу, приложение не падает (клиент после
// паники пересоздаёт worker: инстанс WASM считается отравленным).

import init, { computeProject, floorGrid } from 'compute-wasm';
import type { ComputeRequest, ComputeResponse } from './protocol';

const ready = init();

self.onmessage = async (e: MessageEvent<ComputeRequest>) => {
  const req = e.data;
  let msg: ComputeResponse;
  try {
    await ready;
    if (req.kind === 'grid') {
      msg = {
        requestId: req.requestId,
        status: 'ok-grid',
        response:
          floorGrid(req.roomLengthM, req.roomWidthM, req.tileWM, req.tileHM) ??
          null,
      };
    } else {
      msg = {
        requestId: req.requestId,
        status: 'ok',
        response: computeProject(req.project, req.catalog),
      };
    }
  } catch (err) {
    msg = {
      requestId: req.requestId,
      status: err instanceof WebAssembly.RuntimeError ? 'panic' : 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
  self.postMessage(msg);
};
