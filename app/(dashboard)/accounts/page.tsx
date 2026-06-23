'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, TrendingUp, Layers, ArrowRight } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Project {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  tiktok_handle: string | null;
  instagram_handle: string | null;
  status: string;
  created_at: string;
  ideas_count: number;
  approved_count: number;
}

const STAGE_LABELS: Record<string, string> = {
  intake:    'Brief',
  interview: 'Questions',
  synthesis: 'Profile',
  research:  'Research',
  ideas:     'Ideas',
  done:      'Export',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SummaryCard({ label, value, icon: Icon, loading }: {
  label: string; value: number; icon: React.ElementType; loading: boolean;
}) {
  return (
    <Card className="dark:bg-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardDescription className="flex items-center gap-2">
            <Icon className="size-4" />
            {label}
          </CardDescription>
          <CardTitle className="font-mono text-3xl tabular-nums">
            {loading ? '—' : value}
          </CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function AccountsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  const withTikTok    = projects.filter((p) => p.tiktok_handle).length;
  const withInstagram = projects.filter((p) => p.instagram_handle).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Select a client to open its analytics.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Clients" value={projects.length} icon={Layers} loading={loading} />
          <SummaryCard label="With TikTok" value={withTikTok} icon={TrendingUp} loading={loading} />
          <SummaryCard label="With Instagram" value={withInstagram} icon={Users} loading={loading} />
        </div>

        {/* Clients table */}
        <Card className="dark:bg-transparent">
          <CardHeader>
            <CardTitle>Clients</CardTitle>
            <CardDescription>All client projects. Click a row to view analytics.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {loading ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <p className="text-sm font-medium">No projects yet</p>
                <p className="text-sm text-muted-foreground">
                  Create a project from the dashboard to start tracking analytics.
                </p>
                <Button size="sm" onClick={() => router.push('/')}>Go to dashboard</Button>
              </div>
            ) : (
              <Table className="border-t">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Client</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-end tabular-nums">Ideas</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="pr-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow
                      key={p.id}
                      className="group cursor-pointer"
                      onClick={() => router.push(`/project/${p.id}/analytics`)}
                    >
                      <TableCell className="max-w-[220px] truncate pl-6 font-medium">
                        <span className="truncate">{p.client_name}</span>
                        {p.niche && (
                          <span className="block truncate text-xs font-normal text-muted-foreground">{p.niche}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {p.tiktok_handle && <Badge variant="secondary">TikTok</Badge>}
                          {p.instagram_handle && <Badge variant="secondary">Instagram</Badge>}
                          {!p.tiktok_handle && !p.instagram_handle && (
                            <span className="text-xs text-muted-foreground">None linked</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{STAGE_LABELS[p.status] ?? p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-end text-xs tabular-nums text-muted-foreground">
                        {p.ideas_count > 0 ? p.ideas_count : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</TableCell>
                      <TableCell className="pr-6 text-end">
                        <ArrowRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
