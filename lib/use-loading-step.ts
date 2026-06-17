'use client';

import { useEffect, useRef, useState } from 'react';
import type { LoadingStep } from './generation-steps';

export function useLoadingStep(active: boolean, steps: LoadingStep[]) {
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (interval.current) clearInterval(interval.current);
      interval.current = null;
      setStepIdx(0);
      setElapsed(0);
      return;
    }

    setStepIdx(0);
    setElapsed(0);

    steps.forEach((step, i) => {
      if (step.after === 0) return;
      const t = setTimeout(() => setStepIdx(i), step.after);
      timers.current.push(t);
    });

    interval.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (interval.current) clearInterval(interval.current);
      interval.current = null;
    };
  }, [active, steps]);

  return { label: steps[stepIdx]?.label ?? steps[0].label, stepIdx, elapsed };
}
