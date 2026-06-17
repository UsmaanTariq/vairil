'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const PLATFORMS = ['tiktok', 'instagram'] as const;

interface Project {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  status: string;
  tiktok_handle:    string | null;
  instagram_handle: string | null;
}

interface IntakeProps {
  project: Project;
  onUpdate: (updated: Partial<Project>) => void;
}

export default function IntakeStage({ project, onUpdate }: IntakeProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState('');
  const [niche, setNiche] = useState(project.niche ?? '');
  const [platforms, setPlatforms] = useState<string[]>(project.platforms ?? []);
  const [tiktokHandle,    setTiktokHandle]    = useState(project.tiktok_handle    ?? '');
  const [instagramHandle, setInstagramHandle] = useState(project.instagram_handle ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf' ||
        f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        f.type === 'application/msword'
    );
    setFiles((prev) => [...prev, ...dropped]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim() && files.length === 0) {
      setError('Paste a brief or upload a file to continue.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      if (niche || platforms.length || tiktokHandle || instagramHandle) {
        const tt = tiktokHandle.replace(/^@/, '').trim()    || null;
        const ig = instagramHandle.replace(/^@/, '').trim() || null;
        await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ niche: niche || null, platforms, tiktok_handle: tt, instagram_handle: ig }),
        });
        onUpdate({ niche: niche || null, platforms, tiktok_handle: tt, instagram_handle: ig });
      }

      const fd = new FormData();
      fd.append('project_id', project.id);
      fd.append('raw_text', rawText);
      for (const file of files) {
        fd.append('files', file);
      }

      const res = await fetch('/api/intake', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Intake failed');
      }

      onUpdate({ status: 'interview' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-2">
        <Label htmlFor="brief">Client brief</Label>
        <Textarea
          id="brief"
          rows={10}
          placeholder="Paste the client's brief or business plan here…"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="font-mono text-sm resize-y"
        />
      </div>

      <div className="space-y-2">
        <Label>Upload brief / plan (PDF or DOCX)</Label>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-neutral-300 rounded-lg px-6 py-8 text-center text-sm text-neutral-500 cursor-pointer hover:border-neutral-400 transition-colors"
        >
          {files.length > 0 ? (
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.name} className="text-neutral-700">
                  {f.name}
                </li>
              ))}
            </ul>
          ) : (
            <span>Drag &amp; drop PDF or DOCX, or click to browse</span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="niche">Niche</Label>
        <Input
          id="niche"
          placeholder="e.g. Specialty coffee, Fitness studio, Skincare brand"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <Label>Platforms</Label>
        <div className="flex gap-3">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                platforms.includes(p)
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {platforms.includes('tiktok') && (
        <div className="space-y-2">
          <Label htmlFor="tiktok-handle">TikTok handle <span className="text-neutral-400 font-normal">(optional)</span></Label>
          <Input
            id="tiktok-handle"
            placeholder="@handle"
            value={tiktokHandle}
            onChange={(e) => setTiktokHandle(e.target.value)}
          />
        </div>
      )}

      {platforms.includes('instagram') && (
        <div className="space-y-2">
          <Label htmlFor="instagram-handle">Instagram handle <span className="text-neutral-400 font-normal">(optional)</span></Label>
          <Input
            id="instagram-handle"
            placeholder="@handle"
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Saving brief…' : 'Save brief & continue →'}
      </Button>
    </form>
  );
}
