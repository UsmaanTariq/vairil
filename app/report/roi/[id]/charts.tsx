"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { gbpCompact, fmtViews } from "@/lib/roi";

// Explicit light-mode colours so the report renders identically regardless of the
// app's (dark by default) theme — the PDF is always a clean light sheet.
const INK = "#18181b";
const MUTED = "#71717a";
const GRID = "#e4e4e7";
const GREEN = "#059669";
const BLUE = "#2563eb";

const AXIS = { tickLine: false, axisLine: false } as const;
const TICK = { fontSize: 11, fill: MUTED } as const;

interface ValuePoint { date: string; value: number }
interface FollowerPoint { date: string; tiktok: number | null; instagram: number | null }

export function ReportCharts({
  valueSeries,
  followerSeries,
  hasTikTok,
  hasInstagram,
}: {
  valueSeries: ValuePoint[];
  followerSeries: FollowerPoint[];
  hasTikTok: boolean;
  hasInstagram: boolean;
}) {
  // Tell the PDF renderer the charts have painted (waitForSelector hook).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  const showFollowers = followerSeries.length > 1 && (hasTikTok || hasInstagram);

  return (
    <>
      {valueSeries.length > 1 && (
        <section className="break-inside-avoid">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
            Estimated value driven over time
          </h2>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={valueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rptValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={TICK} {...AXIS} />
                <YAxis tickFormatter={gbpCompact} tick={TICK} width={52} {...AXIS} />
                <Tooltip formatter={(v) => [gbpCompact(typeof v === "number" ? v : 0), "Est. value"]} />
                <Area type="monotone" dataKey="value" stroke={GREEN} strokeWidth={2.5} fill="url(#rptValue)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {showFollowers && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
            Follower growth
          </h2>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={followerSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={TICK} {...AXIS} />
                <YAxis tickFormatter={(v) => fmtViews(typeof v === "number" ? v : 0)} tick={TICK} width={44} {...AXIS} />
                <Tooltip formatter={(v, n) => [fmtViews(typeof v === "number" ? v : 0), n === "tiktok" ? "TikTok" : "Instagram"]} />
                {hasTikTok && <Line type="monotone" dataKey="tiktok" stroke={INK} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />}
                {hasInstagram && <Line type="monotone" dataKey="instagram" stroke={BLUE} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs" style={{ color: MUTED }}>
            {hasTikTok && <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: INK }} />TikTok</span>}
            {hasInstagram && <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full" style={{ background: BLUE }} />Instagram</span>}
          </div>
        </section>
      )}

      {ready && <div data-report-ready />}
    </>
  );
}
