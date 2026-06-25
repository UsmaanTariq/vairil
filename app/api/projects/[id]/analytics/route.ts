import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalytics } from '@/lib/analytics';

export type { HistoryPoint } from '@/lib/analytics';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const analytics = await getProjectAnalytics(id);
  if (!analytics) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json(analytics);
}
