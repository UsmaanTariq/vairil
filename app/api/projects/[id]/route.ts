import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ project: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const {
    tiktok_handle: rawTikTok,
    instagram_handle: rawInstagram,
    value_per_1k_views: rawRpm,
    ...rest
  } = body;

  const tiktok_handle    = rawTikTok    ? String(rawTikTok).replace(/^@/, '').trim()    : undefined;
  const instagram_handle = rawInstagram ? String(rawInstagram).replace(/^@/, '').trim() : undefined;

  const updatePayload: Record<string, unknown> = { ...rest };
  if (tiktok_handle    !== undefined) updatePayload.tiktok_handle    = tiktok_handle    || null;
  if (instagram_handle !== undefined) updatePayload.instagram_handle = instagram_handle || null;
  // Estimated revenue per 1,000 views — empty/invalid clears it, negatives are rejected.
  if (rawRpm !== undefined) {
    const n = rawRpm === null || rawRpm === '' ? null : Number(rawRpm);
    updatePayload.value_per_1k_views = n !== null && Number.isFinite(n) && n >= 0 ? n : null;
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (tiktok_handle) {
    await supabase
      .from('tiktok_accounts')
      .upsert({ handle: tiktok_handle, project_id: id }, { onConflict: 'handle' });
  }
  if (instagram_handle) {
    await supabase
      .from('instagram_accounts')
      .upsert({ handle: instagram_handle, project_id: id }, { onConflict: 'handle' });
  }

  return NextResponse.json({ project: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
