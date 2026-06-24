"use client";

import { useEffect, useState } from "react";
import { useProject } from "../project-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Profile = {
  description: string; audience: string; positioning: string; offers: string;
  tone: string; contentGoals: string; filmingConstraints: string;
};
const FIELDS: { key: keyof Profile; label: string; hint: string }[] = [
  { key: "description", label: "Business description", hint: "One-line summary of the client" },
  { key: "audience", label: "Target audience", hint: "Who they are, age, location, pain points" },
  { key: "positioning", label: "Positioning & differentiator", hint: "What sets them apart" },
  { key: "offers", label: "Offers & products", hint: "What to promote in content" },
  { key: "tone", label: "Tone & brand personality", hint: "How the brand communicates" },
  { key: "contentGoals", label: "Content goals", hint: "Awareness, footfall, sales, followers" },
  { key: "filmingConstraints", label: "Filming constraints", hint: "On-camera comfort, gear, location, budget" },
];

const gbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: n < 100 ? 2 : 0 });
const fmtViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toLocaleString();

export default function ProfilePage() {
  const { project, refresh } = useProject();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  // Revenue/ROI assumption — kept as a string so the field can be cleared/typed freely.
  const [rate, setRate] = useState(project.value_per_1k_views?.toString() ?? "");
  const [savingRate, setSavingRate] = useState(false);
  const [totalViews, setTotalViews] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/synthesis?project_id=${project.id}`).then((r) => r.json()).then((d) => {
      if (d.profile) setProfile(d.profile as Profile);
    });
  }, [project.id]);

  // Pull the client's total tracked views to show a live ROI estimate.
  useEffect(() => {
    fetch(`/api/projects/${project.id}/analytics`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        const tt = d.tiktok?.snapshots?.at(-1)?.views ?? 0;
        const ig = d.instagram?.snapshots?.at(-1)?.views ?? 0;
        setTotalViews(tt + ig);
      })
      .catch(() => {});
  }, [project.id]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    await fetch("/api/synthesis", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: project.id, profile }),
    });
    setSaving(false);
  }

  async function saveRate() {
    setSavingRate(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value_per_1k_views: rate.trim() === "" ? null : rate.trim() }),
    });
    await refresh();
    setSavingRate(false);
  }

  const rateNum = rate.trim() === "" ? null : Number(rate);
  const validRate = rateNum !== null && Number.isFinite(rateNum) && rateNum >= 0;
  const estRevenue = validRate && totalViews ? (totalViews / 1000) * rateNum : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Revenue & ROI */}
      <Card className="dark:bg-transparent">
        <CardHeader>
          <CardTitle>Revenue &amp; ROI</CardTitle>
          <CardDescription>
            Set what each 1,000 views is roughly worth to this client&apos;s business. Used to estimate the
            return you&apos;re driving for them and to feed future reports — a rough outline, not exact accounting.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="rpm">Estimated value per 1,000 views</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
              <Input
                id="rpm"
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                placeholder="10"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveRate()}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">e.g. £10 means every 1,000 views ≈ £10 of value to the business.</p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={saveRate} disabled={savingRate}>{savingRate ? "Saving…" : "Save rate"}</Button>
          </div>

          {/* Live estimate */}
          {validRate && totalViews !== null && totalViews > 0 && (
            <div className="rounded-xl border bg-card/40 p-4">
              <p className="text-xs text-muted-foreground">Estimated value driven so far</p>
              <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-[var(--chart-1)]">
                {estRevenue !== null ? gbp(estRevenue) : "—"}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {fmtViews(totalViews)} total tracked views × {gbp(rateNum)} per 1,000
              </p>
            </div>
          )}
          {validRate && totalViews === 0 && (
            <p className="text-xs text-muted-foreground">No tracked views yet — the estimate appears once analytics has data.</p>
          )}
        </CardContent>
      </Card>

      {/* Business profile */}
      {!profile ? (
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      ) : (
        <Card className="dark:bg-transparent">
          <CardHeader><CardTitle>Business profile</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-5">
            {FIELDS.map(({ key, label, hint }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={`p-${key}`}>{label}</Label>
                <p className="text-xs text-muted-foreground">{hint}</p>
                <Textarea id={`p-${key}`} rows={key === "description" ? 2 : 3}
                  value={profile[key]}
                  onChange={(e) => setProfile((p) => (p ? { ...p, [key]: e.target.value } : p))} />
              </div>
            ))}
            <div><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
