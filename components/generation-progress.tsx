'use client';

import { Check, Loader2 } from 'lucide-react';
import type { LoadingStep } from '@/lib/generation-steps';
import { useLoadingStep } from '@/lib/use-loading-step';

interface GenerationProgressProps {
  active: boolean;
  steps: LoadingStep[];
  title: string;
  estimate: string;
  compact?: boolean;
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function GenerationProgress({
  active,
  steps,
  title,
  estimate,
  compact = false,
}: GenerationProgressProps) {
  const { label, stepIdx, elapsed } = useLoadingStep(active, steps);
  const progress = Math.min(((stepIdx + 1) / steps.length) * 100, 95);

  if (compact) {
    return (
      <div className="py-10 text-center space-y-3">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#6C5CE7]" />
        <p className="text-sm font-medium text-[#1B1B2F]">{label}</p>
        <p className="text-xs text-[#9A9AAE]">
          {formatElapsed(elapsed)} · {estimate}
        </p>
      </div>
    );
  }

  return (
    <div className="py-16 flex justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-[24px] p-8 shadow-[0_8px_24px_rgba(27,27,47,0.05)] space-y-6">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Loader2 className="h-5 w-5 animate-spin text-[#6C5CE7]" />
            <h3 className="text-[15px] font-semibold text-[#1B1B2F]">{title}</h3>
          </div>
          <p className="text-sm text-[#6B6B80]">{label}</p>
        </div>

        <div className="h-1.5 rounded-full bg-[#F0F1F6] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#6C5CE7] transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="space-y-3">
          {steps.map((step, i) => {
            const done = i < stepIdx;
            const current = i === stepIdx;

            return (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    done
                      ? 'bg-[#E6F6EE] text-[#3DBE7A]'
                      : current
                        ? 'bg-[#EEEBFC] text-[#6C5CE7]'
                        : 'bg-[#F5F6FA] text-[#9A9AAE]'
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : current ? (
                    <span className="h-2 w-2 rounded-full bg-[#6C5CE7] animate-pulse" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D0D0DC]" />
                  )}
                </span>
                <span
                  className={`text-sm transition-colors ${
                    done
                      ? 'text-[#9A9AAE] line-through decoration-[#D0D0DC]'
                      : current
                        ? 'text-[#1B1B2F] font-medium'
                        : 'text-[#9A9AAE]'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="text-center text-xs text-[#9A9AAE]">
          {formatElapsed(elapsed)} elapsed · {estimate}
        </p>
      </div>
    </div>
  );
}
