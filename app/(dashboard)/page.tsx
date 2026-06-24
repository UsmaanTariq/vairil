'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Pencil,
  Trash2,
  Plus,
  Eye,
  UserRound,
  Video,
  Users,
} from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Delta, DeltaIcon, DeltaValue } from '@/components/delta';
import {
  ShareBarList,
  ShareBarListContent,
  ShareBarListFill,
  ShareBarListItem,
  ShareBarListLabel,
  ShareBarListValue,
} from '@/components/share-bar-list';
import { formatInteger } from '@/components/formater';

interface Project {
  id: string;
  client_name: string;
  niche: string | null;
  platforms: string[];
  tiktok_handle: string | null;
  instagram_handle: string | null;
  tiktok_followers: number | null;
  instagram_followers: number | null;
  tiktok_profile_pic_url: string | null;
  instagram_profile_pic_url: string | null;
  status: string;
  created_at: string;
  ideas_count: number;
  approved_count: number;
  trends_count: number;
}

function fmt(n: number | null) {
  if (n === null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// Y-axis domain padded around the data's actual min/max so small variation in
// large values (e.g. cumulative views) is visible instead of looking flat.
function paddedDomain(values: number[], padRatio = 0.2): [number, number] | ['auto', 'auto'] {
  if (!values.length) return ['auto', 'auto'];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    return [Math.max(0, min - pad), max + pad];
  }
  const pad = (max - min) * padRatio;
  return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
}

// Compact axis tick: 10.4M / 64.8K / 532
function axisFmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

const STAGE_LABELS: Record<string, string> = {
  intake:    'Brief',
  interview: 'Questions',
  synthesis: 'Profile',
  research:  'Research',
  ideas:     'Ideas',
  done:      'Export',
};


function MiniSparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const w = 72, h = 24;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="shrink-0">
      <polyline points={pts} stroke={up ? 'var(--chart-1)' : 'var(--chart-3)'} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  deltaPct,
  note,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | null;
  deltaPct: number | null;
  note?: string;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card className="dark:bg-transparent">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="font-mono text-3xl tabular-nums">
          {loading ? '—' : (value ?? '—')}
        </CardTitle>
      </CardHeader>
      {!loading && deltaPct !== null ? (
        <CardFooter className="gap-1.5 text-xs">
          <Delta value={deltaPct} variant="default">
            <DeltaIcon variant="arrow" />
            <DeltaValue suffix="%" />
          </Delta>
          <span className="text-muted-foreground">vs previous day</span>
        </CardFooter>
      ) : !loading && note ? (
        <CardFooter className="text-xs text-muted-foreground">{note}</CardFooter>
      ) : null}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  interface RecentIdea {
    id: string;
    title: string;
    hook: string;
    status: 'draft' | 'approved';
    project_id: string;
    client_name: string;
  }
  const [recentIdeas, setRecentIdeas] = useState<RecentIdea[]>([]);
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editNiche, setEditNiche] = useState('');
  const [editPlatforms, setEditPlatforms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [combinedTrend, setCombinedTrend] = useState<{ date: string; views: number }[]>([]);

  interface ViewsBreakdownItem { project_id: string; client_name: string; views: number; fill: string }
  const [viewsBreakdown, setViewsBreakdown] = useState<ViewsBreakdownItem[]>([]);
  const [engagementTrend, setEngagementTrend] = useState<{ date: string; rate: number }[]>([]);

  interface Kpis {
    views:     { today: number; delta_pct: number | null };
    followers: { total: number; delta_pct: number | null };
    videos:    { total: number };
    clients:   { total: number };
  }
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [velocity, setVelocity] = useState<Record<string, { trend: number[]; delta_pct: number | null }>>({});

  useEffect(() => {
    const DONUT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/ideas/recent').then((r) => r.json()),
      fetch('/api/analytics/combined-views').then((r) => r.json()),
      fetch('/api/analytics/kpis').then((r) => r.json()),
      fetch('/api/analytics/velocity').then((r) => r.json()),
      fetch('/api/analytics/views-by-project').then((r) => r.json()),
      fetch('/api/analytics/engagement-trend').then((r) => r.json()),
    ]).then(([projectsData, ideasData, trendData, kpisData, velocityData, breakdownData, engData]) => {
      setProjects(projectsData.projects ?? []);
      setRecentIdeas(ideasData.ideas ?? []);
      setCombinedTrend(trendData.trend ?? []);
      setKpis(kpisData);
      setVelocity(velocityData.velocity ?? {});
      setViewsBreakdown(
        (breakdownData.breakdown ?? []).map((item: { project_id: string; client_name: string; views: number }, i: number) => ({
          ...item,
          fill: DONUT_COLORS[i % DONUT_COLORS.length],
        }))
      );
      setEngagementTrend(engData.trend ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!clientName.trim()) return;
    setCreating(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: clientName.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    setOpen(false);
    setClientName('');
    if (data.project) router.push(`/project/${data.project.id}`);
  }

  function openEdit(p: Project) {
    setEditingProject(p);
    setEditName(p.client_name);
    setEditNiche(p.niche ?? '');
    setEditPlatforms(p.platforms ?? []);
  }

  function toggleEditPlatform(pl: string) {
    setEditPlatforms((prev) =>
      prev.includes(pl) ? prev.filter((x) => x !== pl) : [...prev, pl]
    );
  }

  async function handleSaveClient() {
    if (!editingProject || !editName.trim()) return;
    setSaving(true);
    await fetch(`/api/projects/${editingProject.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: editName.trim(),
        niche: editNiche.trim() || null,
        platforms: editPlatforms,
      }),
    });
    setProjects((prev) =>
      prev.map((p) =>
        p.id === editingProject.id
          ? { ...p, client_name: editName.trim(), niche: editNiche.trim() || null, platforms: editPlatforms }
          : p
      )
    );
    setSaving(false);
    setEditingProject(null);
  }

  async function handleDelete() {
    if (!deletingProject) return;
    setDeleting(true);
    await fetch(`/api/projects/${deletingProject.id}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
    setDeleting(false);
    setDeletingProject(null);
  }

  // Per-day combined views = the day-over-day gain between cumulative snapshots (clamped at 0).
  const combinedPerDay = combinedTrend.slice(1).map((d, i) => ({
    date: d.date,
    views: Math.max(0, d.views - combinedTrend[i].views),
  }));

  const latestCumulative = combinedTrend.length ? combinedTrend[combinedTrend.length - 1].views : 0;

  // Top accounts by combined followers.
  const topAccounts = [...projects]
    .map((p) => ({
      id: p.id,
      label: p.client_name,
      followers: (p.tiktok_followers ?? 0) + (p.instagram_followers ?? 0),
    }))
    .filter((a) => a.followers > 0)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 5);
  const maxFollowers = Math.max(1, ...topAccounts.map((a) => a.followers));

  const viewsConfig = {
    views: { label: 'Views', color: 'var(--chart-1)' },
  } satisfies ChartConfig;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Combined performance across all client accounts.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Combined views"
            value={kpis ? fmt(kpis.views.today) ?? String(kpis.views.today) : null}
            deltaPct={kpis?.views.delta_pct ?? null}
            icon={Eye}
            loading={loading}
          />
          <StatCard
            label="Total followers"
            value={kpis ? fmt(kpis.followers.total) ?? String(kpis.followers.total) : null}
            deltaPct={kpis?.followers.delta_pct ?? null}
            icon={UserRound}
            loading={loading}
          />
          <StatCard
            label="Videos posted"
            value={kpis ? String(kpis.videos.total) : null}
            deltaPct={null}
            note="Across all accounts"
            icon={Video}
            loading={loading}
          />
          <StatCard
            label="Clients"
            value={kpis ? String(kpis.clients.total) : null}
            deltaPct={null}
            note="Total tracked"
            icon={Users}
            loading={loading}
          />
        </div>

        {/* Cumulative views + pipeline */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-3 dark:bg-transparent">
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex flex-col gap-1.5">
                <CardTitle className="font-mono text-2xl tabular-nums">
                  {formatInteger(latestCumulative)}
                </CardTitle>
                <CardDescription>Cumulative views (TikTok + Instagram)</CardDescription>
              </div>
              {kpis?.views.delta_pct != null && (
                <Delta value={kpis.views.delta_pct} variant="badge">
                  <DeltaIcon variant="trend" />
                  <DeltaValue suffix="%" />
                </Delta>
              )}
            </CardHeader>
            <CardContent>
              {combinedTrend.length >= 2 ? (
                <ChartContainer className="aspect-auto h-60 w-full" config={viewsConfig}>
                  <AreaChart accessibilityLayer data={combinedTrend} margin={{ left: 12, right: 12 }}>
                    <defs>
                      <linearGradient id="dash-views" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-views)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-views)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis axisLine={false} dataKey="date" tickLine={false} tickMargin={8} />
                    <YAxis axisLine={false} tickLine={false} width={44} tickMargin={4}
                      domain={paddedDomain(combinedTrend.map((d) => d.views))}
                      tickFormatter={axisFmt} />
                    <ChartTooltip
                      content={<ChartTooltipContent indicator="dashed" />}
                      cursor={{ stroke: 'var(--color-views)', strokeDasharray: '3 3', strokeLinecap: 'round' }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Area dataKey="views" name="Views" type="monotone" stroke="var(--color-views)"
                      strokeWidth={2} fill="url(#dash-views)" isAnimationActive={false}
                      dot={{ fill: 'var(--color-views)', r: 2, strokeWidth: 2 }} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                  {loading ? 'Loading…' : 'Not enough data yet.'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1 dark:bg-transparent">
            <CardHeader>
              <CardTitle>Views by client</CardTitle>
              <CardDescription>Share of total views per project.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {viewsBreakdown.length > 0 ? (
                <>
                  <PieChart width={180} height={180} className="mx-auto">
                    <Pie
                      data={viewsBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="views"
                      stroke="none"
                    />
                    <Tooltip
                      formatter={(v) => [typeof v === 'number' ? (fmt(v) ?? v) : v, 'Views']}
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        color: 'var(--popover-foreground)',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                  <ul className="flex flex-col gap-1.5">
                    {viewsBreakdown.map((item) => {
                      const total = viewsBreakdown.reduce((s, i) => s + i.views, 0);
                      const pct = total > 0 ? Math.round((item.views / total) * 100) : 0;
                      return (
                        <li key={item.project_id} className="flex items-center gap-2 text-xs cursor-pointer hover:opacity-80"
                          onClick={() => router.push(`/project/${item.project_id}`)}>
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.fill }} />
                          <span className="flex-1 truncate text-muted-foreground">{item.client_name}</span>
                          <span className="tabular-nums font-medium">{pct}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  {loading ? 'Loading…' : 'No view data yet.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Engagement rate + top accounts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="dark:bg-transparent">
            <CardHeader>
              <CardTitle>Avg engagement rate</CardTitle>
              <CardDescription>Daily average across all accounts (TikTok + Instagram).</CardDescription>
            </CardHeader>
            <CardContent>
              {engagementTrend.length >= 2 ? (
                <ChartContainer className="aspect-auto h-56 w-full" config={{ rate: { label: 'Engagement', color: 'var(--chart-2)' } }}>
                  <AreaChart accessibilityLayer data={engagementTrend} margin={{ left: 12, right: 12 }}>
                    <defs>
                      <linearGradient id="dash-eng" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis axisLine={false} dataKey="date" tickLine={false} tickMargin={8} />
                    <YAxis axisLine={false} tickLine={false} width={44} tickMargin={4}
                      domain={paddedDomain(engagementTrend.map((d) => d.rate))}
                      tickFormatter={(v) => `${v}%`} />
                    <ChartTooltip
                      content={<ChartTooltipContent indicator="dashed" />}
                      cursor={{ stroke: 'var(--chart-2)', strokeDasharray: '3 3', strokeLinecap: 'round' }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Area dataKey="rate" name="Engagement %" type="monotone" stroke="var(--chart-2)"
                      strokeWidth={2} fill="url(#dash-eng)" isAnimationActive={false}
                      dot={{ fill: 'var(--chart-2)', r: 2, strokeWidth: 2 }} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  {loading ? 'Loading…' : 'Not enough data yet.'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="dark:bg-transparent">
            <CardHeader>
              <CardTitle>Top accounts</CardTitle>
              <CardDescription>Ranked by combined followers.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 py-2">
              {topAccounts.length > 0 ? (
                <ShareBarList>
                  {topAccounts.map((a) => (
                    <ShareBarListItem key={a.id} value={(a.followers / maxFollowers) * 100}
                      className="cursor-pointer" onClick={() => router.push(`/project/${a.id}`)}>
                      <ShareBarListContent>
                        <ShareBarListLabel className="truncate">{a.label}</ShareBarListLabel>
                        <ShareBarListValue>{fmt(a.followers)}</ShareBarListValue>
                      </ShareBarListContent>
                      <ShareBarListFill />
                    </ShareBarListItem>
                  ))}
                </ShareBarList>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  No follower data yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Projects + recent ideas */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="dark:bg-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Projects
                {!loading && projects.length > 0 && (
                  <Badge variant="secondary">{projects.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>All client projects and their current stage.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {loading ? (
                <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <p className="text-sm font-medium">No projects yet</p>
                  <Button onClick={() => setOpen(true)} size="sm">
                    <Plus className="size-4" /> New project
                  </Button>
                </div>
              ) : (
                <Table className="border-t">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Client</TableHead>
                      <TableHead className="text-end tabular-nums">Followers</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="pr-6 text-end">Velocity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((p) => {
                      const combined = (p.tiktok_followers ?? 0) + (p.instagram_followers ?? 0);
                      const vel = velocity[p.id];
                      const hasVel = vel && vel.trend.length >= 2;
                      const velUp = !!hasVel && (vel.delta_pct === null || vel.delta_pct >= 0);
                      return (
                        <TableRow key={p.id} className="group cursor-pointer"
                          onClick={() => router.push(`/project/${p.id}`)}>
                          <TableCell className="max-w-[220px] truncate pl-6 font-medium">
                            <div className="flex items-center gap-2">
                              {p.tiktok_profile_pic_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.tiktok_profile_pic_url} alt="" className="size-6 shrink-0 rounded-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              )}
                              <span className="truncate">{p.client_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-end text-xs tabular-nums text-muted-foreground">
                            {combined > 0 ? fmt(combined) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{STAGE_LABELS[p.status] ?? p.status}</Badge>
                          </TableCell>
                          <TableCell className="pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <span className="opacity-0 transition-opacity group-hover:opacity-100 flex gap-1">
                                <Button size="icon-sm" variant="ghost"
                                  onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button size="icon-sm" variant="ghost"
                                  onClick={(e) => { e.stopPropagation(); setDeletingProject(p); }}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </span>
                              {hasVel ? <MiniSparkline data={vel.trend} up={velUp} /> : <span className="text-xs text-muted-foreground">—</span>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="dark:bg-transparent">
            <CardHeader>
              <CardTitle>Recent ideas</CardTitle>
              <CardDescription>Latest generated content ideas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {loading ? (
                <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
              ) : recentIdeas.length === 0 ? (
                <p className="px-6 py-8 text-sm text-muted-foreground">No ideas yet.</p>
              ) : (
                <ul className="divide-y border-t">
                  {recentIdeas.slice(0, 8).map((idea) => (
                    <li key={idea.id}
                      onClick={() => router.push(`/project/${idea.project_id}`)}
                      className="flex cursor-pointer items-start justify-between gap-3 px-6 py-3 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{idea.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{idea.client_name}</p>
                      </div>
                      {idea.status === 'approved' && (
                        <Badge className="shrink-0" variant="secondary">Approved</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New project dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="client-name">Client name</Label>
              <Input
                id="client-name"
                placeholder="e.g. Bloom Coffee Co."
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!clientName.trim() || creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit client dialog */}
      <Dialog open={!!editingProject} onOpenChange={(o) => !o && setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Client name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-niche">Niche</Label>
              <Input id="edit-niche" placeholder="e.g. Specialty coffee, Fitness studio…"
                value={editNiche} onChange={(e) => setEditNiche(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Platforms</Label>
              <div className="flex gap-2">
                {['tiktok', 'instagram'].map((pl) => (
                  <Button key={pl} type="button"
                    variant={editPlatforms.includes(pl) ? 'default' : 'outline'}
                    onClick={() => toggleEditPlatform(pl)}>
                    {pl.charAt(0).toUpperCase() + pl.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProject(null)}>Cancel</Button>
            <Button onClick={handleSaveClient} disabled={!editName.trim() || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deletingProject} onOpenChange={(o) => !o && setDeletingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-foreground">{deletingProject?.client_name}</span>?
            {' '}This will permanently remove all briefs, answers, trends, and ideas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProject(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
