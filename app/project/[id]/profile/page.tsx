"use client";

import { useEffect, useState } from "react";
import { useProject } from "../project-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

export default function ProfilePage() {
  const { project } = useProject();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/synthesis?project_id=${project.id}`).then((r) => r.json()).then((d) => {
      if (d.profile) setProfile(d.profile as Profile);
    });
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

  if (!profile) return <p className="text-sm text-muted-foreground">Loading profile…</p>;

  return (
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
  );
}
