import { getProjectAnalytics } from "@/lib/analytics";
import { supabase } from "@/lib/db";
import {
  computeRoi, periodRange, periodDescription, PERIOD_LABELS,
  gbp, fmtViews, type PeriodKey,
} from "@/lib/roi";
import { ReportCharts } from "./charts";

const AGENCY_NAME = process.env.NEXT_PUBLIC_AGENCY_NAME || "Vairil";
const AGENCY_LOGO = process.env.NEXT_PUBLIC_AGENCY_LOGO_URL || "";

const INK = "#18181b";
const MUTED = "#71717a";
const GREEN = "#059669";

// Always render as a clean light A4 sheet, independent of the app's dark theme.
export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#e4e4e7" }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums" style={{ color: INK }}>{value}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: MUTED }}>{sub}</p>}
    </div>
  );
}

export default async function RoiReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const period = (["30d", "month", "90d", "all"].includes(sp.period ?? "") ? sp.period : "all") as PeriodKey;

  const { data: project } = await supabase
    .from("projects")
    .select("client_name, value_per_1k_views, monthly_retainer")
    .eq("id", id)
    .single();

  const rate = project?.value_per_1k_views ?? null;
  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  if (!project || rate === null) {
    return (
      <main className="mx-auto max-w-2xl p-12" style={{ background: "#fff", color: INK, colorScheme: "light", minHeight: "100vh" }}>
        <p className="text-sm" style={{ color: MUTED }}>
          This report needs a value-per-1,000-views rate set on the client&apos;s Profile before it can be generated.
        </p>
        <div data-report-ready />
      </main>
    );
  }

  const range = periodRange(period);
  const model = computeRoi(await getProjectAnalytics(id), {
    rate,
    retainer: project.monthly_retainer ?? null,
    ...range,
  });

  const periodLabel = periodDescription(period, range);
  const hasTikTok = model.ttFollowerGrowth !== null || model.ttValue > 0;
  const hasInstagram = model.igFollowerGrowth !== null || model.igValue > 0;
  const topSix = model.topContent.slice(0, 6);

  return (
    <main
      className="mx-auto px-12 py-10"
      style={{ background: "#fff", color: INK, colorScheme: "light", width: "794px", minHeight: "100vh" }}
    >
      {/* ── Cover header ───────────────────────────────────────────── */}
      <header className="mb-8 flex items-center justify-between border-b pb-6" style={{ borderColor: "#e4e4e7" }}>
        <div className="flex items-center gap-3">
          {AGENCY_LOGO ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={AGENCY_LOGO} alt={AGENCY_NAME} style={{ height: 36 }} referrerPolicy="no-referrer" />
          ) : (
            <span className="text-lg font-bold tracking-tight" style={{ color: INK }}>{AGENCY_NAME}</span>
          )}
        </div>
        <p className="text-xs" style={{ color: MUTED }}>Generated {generatedOn}</p>
      </header>

      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: GREEN }}>Performance &amp; ROI report</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight" style={{ color: INK }}>{project.client_name}</h1>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>{periodLabel} · {PERIOD_LABELS[period]}</p>
      </div>

      {/* ── Headline / executive summary ───────────────────────────── */}
      <section className="mb-8 break-inside-avoid">
        {model.roiMultiple !== null && (
          <div className="mb-4 rounded-2xl p-6" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
            <p className="text-sm font-medium" style={{ color: "#047857" }}>Return on investment</p>
            <p className="mt-1 font-mono text-4xl font-bold tabular-nums" style={{ color: "#065f46" }}>
              {model.roiMultiple.toFixed(1)}× return
            </p>
            <p className="mt-1 text-sm" style={{ color: "#047857" }}>
              {gbp(model.totalValue)} of estimated value generated on a {gbp(model.retainer!)}/mo retainer.
            </p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Value driven" value={gbp(model.totalValue)} sub={PERIOD_LABELS[period]} />
          <Stat label="Views driven" value={fmtViews(model.totalViews)} sub={`${model.contentCount} pieces active`} />
          <Stat label="Total engagement" value={fmtViews(model.engagement.total)} sub="likes · comments · shares" />
          <Stat label="Likes" value={fmtViews(model.engagement.likes)} />
          <Stat label="Comments" value={fmtViews(model.engagement.comments)} />
          <Stat label="Shares" value={fmtViews(model.engagement.shares)} />
        </div>
      </section>

      {/* ── Charts (client island) ─────────────────────────────────── */}
      <ReportCharts
        valueSeries={model.valueSeries}
        followerSeries={model.followerSeries}
        hasTikTok={hasTikTok}
        hasInstagram={hasInstagram}
      />

      {/* ── Platform split ─────────────────────────────────────────── */}
      {model.ttValue > 0 && model.igValue > 0 && (
        <section className="mt-8 break-inside-avoid">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Value by platform</h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="TikTok" value={gbp(model.ttValue)} sub={`${Math.round((model.ttValue / model.totalValue) * 100)}% of total${model.ttFollowerGrowth ? ` · +${fmtViews(model.ttFollowerGrowth)} followers` : ""}`} />
            <Stat label="Instagram" value={gbp(model.igValue)} sub={`${Math.round((model.igValue / model.totalValue) * 100)}% of total${model.igFollowerGrowth ? ` · +${fmtViews(model.igFollowerGrowth)} followers` : ""}`} />
          </div>
        </section>
      )}

      {/* ── Best performing content ────────────────────────────────── */}
      {topSix.length > 0 && (
        <section className="mt-8 break-before-page pt-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Best performing content</h2>
          <div className="flex flex-col gap-2.5">
            {topSix.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border p-3 break-inside-avoid" style={{ borderColor: "#e4e4e7" }}>
                <span className="w-5 text-sm font-mono shrink-0" style={{ color: MUTED }}>{i + 1}</span>
                {c.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnail_url} alt="" referrerPolicy="no-referrer"
                    style={{ width: 44, height: 56, objectFit: "cover", borderRadius: 8, background: "#f4f4f5" }} />
                ) : (
                  <div style={{ width: 44, height: 56, borderRadius: 8, background: "#f4f4f5" }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: INK }}>{c.label}</p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    {c.platform} · {fmtViews(c.views)} views · {fmtViews(c.likes)} likes
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold tabular-nums shrink-0" style={{ color: GREEN }}>{gbp(c.value)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Methodology footnote ───────────────────────────────────── */}
      <footer className="mt-10 border-t pt-4" style={{ borderColor: "#e4e4e7" }}>
        <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
          Methodology: estimated value is derived from tracked views at an assumed {gbp(rate)} per 1,000 views — a
          directional measure of the reach this content delivered (comparable to equivalent paid-ad spend), not exact
          revenue. Figures cover {periodLabel.toLowerCase()} and are based on snapshots of public TikTok and Instagram
          metrics. Prepared by {AGENCY_NAME}.
        </p>
      </footer>
    </main>
  );
}
