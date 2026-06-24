"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PoundSterling, TrendingUp, Film, Trophy, type LucideIcon } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

import { useProject } from "../project-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ── Types we consume from /api/projects/[id]/analytics ───────────────────────
interface VideoStat { video_id: string; title: string; views: number; thumbnail_url: string | null }
interface PostStat  { post_id: string; caption: string; views: number | null; thumbnail_url: string | null }
interface TrendPoint { fetched_at: string; views?: number }
interface AnalyticsData {
  tiktok:    { latest_snapshot: { videos?: VideoStat[] } | null; snapshots: TrendPoint[] } | null;
  instagram: { latest_snapshot: { posts?:  PostStat[]  } | null; snapshots: TrendPoint[] } | null;
}

// ── Formatting ───────────────────────────────────────────────────────────────
const gbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: n < 100 ? 2 : 0 });
const gbpCompact = (n: number) =>
  n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `£${(n / 1_000).toFixed(1)}K` : `£${Math.round(n)}`;
const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// ── Recharts theme bits (mirrors the Analytics page) ─────────────────────────
const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)", border: "1px solid var(--border)",
  borderRadius: "12px", color: "var(--popover-foreground)", fontSize: "12px",
};
const AXIS = { tickLine: false, axisLine: false } as const;
const TICK = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const GRID_H = { strokeDasharray: "4 4", stroke: "var(--border)", vertical: false } as const;
const GRID_V = { strokeDasharray: "4 4", stroke: "var(--border)", horizontal: false } as const;
const BAR_CURSOR = { fill: "color-mix(in srgb, var(--foreground) 8%, transparent)" } as const;
const LINE_CURSOR = { stroke: "var(--border)", strokeWidth: 1 } as const;
const GREEN = "var(--chart-1)";

function StatCard({ label, value, sub, icon: Icon }: {
  label: string; value: string; sub?: string; icon: LucideIcon;
}) {
  return (
    <Card className="dark:bg-transparent">
      <CardHeader className="flex flex-col gap-1.5">
        <CardDescription className="flex items-center gap-2"><Icon className="size-4" />{label}</CardDescription>
        <CardTitle className="font-mono text-3xl tabular-nums">{value}</CardTitle>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="dark:bg-transparent">
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Most-recent cumulative views <= t, carried forward so a missing platform
// snapshot on a given day doesn't drop its lifetime total to zero.
function lastAtOrBefore(pts: { t: number; views: number }[], t: number): number {
  let v = 0;
  for (const p of pts) { if (p.t <= t) v = p.views; else break; }
  return v;
}

export default function RoiPage() {
  const { project } = useProject();
  const rate = project.value_per_1k_views;
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${project.id}/analytics`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [project.id]);

  // No rate yet → point the manager to Profile.
  if (rate === null || rate === undefined) {
    return (
      <Card className="dark:bg-transparent">
        <CardHeader>
          <CardTitle>Set a revenue rate first</CardTitle>
          <CardDescription>
            ROI is estimated from how much each 1,000 views is worth to this client. Add that figure on the
            Profile tab and the monetary impact charts will populate here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/project/${project.id}/profile`}><Button>Go to Profile →</Button></Link>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <Card className="dark:bg-transparent"><CardContent className="py-6 text-sm text-muted-foreground">Loading…</CardContent></Card>;
  }

  const ttSnaps = data?.tiktok?.snapshots ?? [];
  const igSnaps = data?.instagram?.snapshots ?? [];
  const ttVideos = data?.tiktok?.latest_snapshot?.videos ?? [];
  const igPosts  = data?.instagram?.latest_snapshot?.posts ?? [];

  const toMoney = (views: number) => (views / 1000) * rate;

  // Cumulative value over time, combining both platforms by date (carry-forward).
  const ttPts = ttSnaps.map((s) => ({ t: new Date(s.fetched_at).getTime(), views: s.views ?? 0 }));
  const igPts = igSnaps.map((s) => ({ t: new Date(s.fetched_at).getTime(), views: s.views ?? 0 }));
  const allT = Array.from(new Set([...ttPts, ...igPts].map((p) => p.t))).sort((a, b) => a - b);
  const valueSeries = allT.map((t) => ({
    date: shortDate(t),
    value: toMoney(lastAtOrBefore(ttPts, t) + lastAtOrBefore(igPts, t)),
  }));

  // Value generated between each refresh (clamped at 0).
  const perDay = valueSeries.slice(1).map((p, i) => ({
    date: p.date,
    value: Math.max(0, p.value - valueSeries[i].value),
  }));

  const totalValue = valueSeries.at(-1)?.value ?? 0;
  const ttValue    = toMoney(ttSnaps.at(-1)?.views ?? 0);
  const igValue    = toMoney(igSnaps.at(-1)?.views ?? 0);
  const lastGain   = perDay.at(-1)?.value ?? 0;
  const contentCount = ttVideos.length + igPosts.length;
  const avgValue   = contentCount ? totalValue / contentCount : 0;

  // Top earning content across both platforms.
  const allContent = [
    ...ttVideos.map((v) => ({ label: v.title || v.video_id, value: toMoney(v.views), platform: "TikTok" })),
    ...igPosts.map((p)  => ({ label: p.caption || p.post_id, value: toMoney(p.views ?? 0), platform: "Instagram" })),
  ].sort((a, b) => b.value - a.value);
  const topContent = allContent.slice(0, 10).map((c, i) => ({
    name: c.label ? (c.label.length > 26 ? c.label.slice(0, 26) + "…" : c.label) : `#${i + 1}`,
    value: Math.round(c.value),
  }));
  const topEarner = allContent[0] ?? null;

  const hasData = ttSnaps.length > 0 || igSnaps.length > 0;
  if (!hasData) {
    return (
      <Card className="dark:bg-transparent">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No analytics data yet — refresh a platform on the Analytics tab and the ROI estimate will appear here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ROI</h1>
          <p className="text-sm text-muted-foreground">Estimated business value at {gbp(rate)} per 1,000 views.</p>
        </div>
        <Link href={`/project/${project.id}/profile`}>
          <Button variant="ghost" size="sm">Adjust rate</Button>
        </Link>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total value driven" value={gbp(totalValue)} sub="Across all tracked content" icon={PoundSterling} />
        <StatCard label="Value since last refresh" value={gbp(lastGain)} sub={perDay.length ? "Most recent period" : "Need 2+ snapshots"} icon={TrendingUp} />
        <StatCard label="Avg value / post" value={gbp(avgValue)} sub={`${contentCount} pieces tracked`} icon={Film} />
        <StatCard label="Top earner" value={topEarner ? gbp(topEarner.value) : "—"} sub={topEarner ? topEarner.platform : undefined} icon={Trophy} />
      </div>

      {/* Platform split */}
      {ttValue > 0 && igValue > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="TikTok value" value={gbp(ttValue)} sub={`${Math.round((ttValue / totalValue) * 100)}% of total`} icon={PoundSterling} />
          <StatCard label="Instagram value" value={gbp(igValue)} sub={`${Math.round((igValue / totalValue) * 100)}% of total`} icon={PoundSterling} />
        </div>
      )}

      {/* Value over time */}
      {valueSeries.length > 1 ? (
        <ChartCard title="Estimated value driven over time">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={valueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="roiValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_H} />
              <XAxis dataKey="date" tick={TICK} {...AXIS} />
              <YAxis tickFormatter={gbpCompact} tick={TICK} width={52} {...AXIS} />
              <Tooltip formatter={(v) => [gbp(typeof v === "number" ? v : 0), "Est. value"]} contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
              <Area type="monotone" dataKey="value" stroke={GREEN} strokeWidth={2.5} fill="url(#roiValue)" dot={false} activeDot={{ r: 4, fill: GREEN, stroke: "var(--background)", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <Card className="dark:bg-transparent">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Once there are at least two snapshots, you&apos;ll see how value has accumulated over time.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Value generated per period */}
        {perDay.length > 0 && (
          <ChartCard title="Value generated per refresh">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={perDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID_H} />
                <XAxis dataKey="date" tick={TICK} {...AXIS} />
                <YAxis tickFormatter={gbpCompact} tick={TICK} width={52} {...AXIS} />
                <Tooltip formatter={(v) => [gbp(typeof v === "number" ? v : 0), "Value gained"]} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                <Bar dataKey="value" fill={GREEN} radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Top content by value */}
        {topContent.length > 0 && (
          <ChartCard title="Top content by estimated value">
            <ResponsiveContainer width="100%" height={Math.max(240, topContent.length * 34)}>
              <BarChart layout="vertical" data={topContent} margin={{ left: 0, right: 12 }}>
                <CartesianGrid {...GRID_V} />
                <XAxis type="number" tickFormatter={gbpCompact} tick={TICK} {...AXIS} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} {...AXIS} />
                <Tooltip formatter={(v) => [gbp(typeof v === "number" ? v : 0), "Est. value"]} contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
                <Bar dataKey="value" fill={GREEN} radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Estimates only — a directional view of impact based on your {gbp(rate)}/1,000-view assumption, not exact revenue.
      </p>
    </div>
  );
}
