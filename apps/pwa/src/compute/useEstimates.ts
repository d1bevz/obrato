// React-хук поверх ComputeClient: пересчёт при смене проекта, latest-wins
// (generation-supersede, гл.09 §2) — устаревший ответ не перетирает свежий.

import { useEffect, useState } from 'react';
import type { EstimateResponse } from 'compute-wasm';
import type { Project } from '../types';
import { ComputeFailure, computeEstimates } from './client';

export interface EstimatesState {
  data: EstimateResponse | null;
  error: ComputeFailure | null;
  loading: boolean;
}

export function useEstimates(project: Project | null): EstimatesState {
  const [state, setState] = useState<EstimatesState>({
    data: null,
    error: null,
    loading: project != null,
  });

  useEffect(() => {
    if (!project) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let superseded = false;
    setState((s) => ({ ...s, loading: true }));
    computeEstimates(project).then(
      (data) => {
        if (!superseded) setState({ data, error: null, loading: false });
      },
      (error: ComputeFailure) => {
        if (!superseded) setState({ data: null, error, loading: false });
      },
    );
    return () => {
      superseded = true;
    };
  }, [project]);

  return state;
}
