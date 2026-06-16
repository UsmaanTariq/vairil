'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface Profile {
  description: string;
  audience: string;
  positioning: string;
  offers: string;
  tone: string;
  contentGoals: string;
  filmingConstraints: string;
}

const PROFILE_FIELDS: { key: keyof Profile; label: string; hint: string }[] = [
  {
    key: 'description',
    label: 'Business description',
    hint: 'One-line summary of the client',
  },
  {
    key: 'audience',
    label: 'Target audience',
    hint: 'Who they are, age, location, pain points',
  },
  {
    key: 'positioning',
    label: 'Positioning & differentiator',
    hint: 'What sets them apart from competitors',
  },
  {
    key: 'offers',
    label: 'Offers & products',
    hint: 'What to promote in content',
  },
  {
    key: 'tone',
    label: 'Tone & brand personality',
    hint: 'How the brand communicates',
  },
  {
    key: 'contentGoals',
    label: 'Content goals',
    hint: 'Awareness, footfall, sales, followers, etc.',
  },
  {
    key: 'filmingConstraints',
    label: 'Filming constraints',
    hint: 'On-camera comfort, who films, gear, location, budget',
  },
];

interface SynthesisProps {
  projectId: string;
  onUpdate: (updated: { status: string }) => void;
}

export default function SynthesisStage({ projectId, onUpdate }: SynthesisProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/synthesis?project_id=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setProfile(d.profile as Profile);
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [projectId]);

  function updateField(key: keyof Profile, value: string) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function handleConfirm() {
    if (!profile) return;
    setConfirming(true);
    setError('');

    try {
      const res = await fetch('/api/synthesis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, confirmed: true, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to confirm profile');

      onUpdate({ status: 'research' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setConfirming(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError('');

    try {
      // Re-run synthesis using the saved answers from DB (no body.answers)
      const res = await fetch('/api/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to regenerate profile');

      setProfile(data.profile as Profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRegenerating(false);
    }
  }

  async function handleEditAnswers() {
    // Reset project status to interview so the user can change their answers
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'interview' }),
      });
      onUpdate({ status: 'interview' });
    } catch {
      setError('Failed to go back to questions');
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-neutral-400 animate-pulse">Loading profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-neutral-400">No profile found. Something went wrong.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-neutral-950 mb-1">
          Business profile
        </h3>
        <p className="text-sm text-neutral-500">
          Review and edit the profile — this becomes the source of truth for all content ideas.
        </p>
      </div>

      <div className="space-y-6">
        {PROFILE_FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1.5">
            <Label
              htmlFor={key}
              className="text-sm font-medium text-neutral-700"
            >
              {label}
            </Label>
            <p className="text-xs text-neutral-400">{hint}</p>
            <Textarea
              id={key}
              rows={key === 'description' ? 2 : 3}
              value={profile[key]}
              onChange={(e) => updateField(key, e.target.value)}
              className="resize-y"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Separator />

      <div className="flex flex-col gap-3">
        <Button onClick={handleConfirm} disabled={confirming || regenerating} className="w-full">
          {confirming ? 'Confirming…' : 'Confirm profile & continue →'}
        </Button>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleRegenerate}
            disabled={confirming || regenerating}
            className="flex-1"
          >
            {regenerating ? 'Regenerating…' : 'Regenerate profile'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleEditAnswers}
            disabled={confirming || regenerating}
            className="flex-1"
          >
            Edit answers
          </Button>
        </div>
      </div>
    </div>
  );
}
