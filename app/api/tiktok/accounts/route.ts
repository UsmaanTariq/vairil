import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  const { data: accounts, error } = await supabase
    .from('tiktok_accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accountsWithSnapshots = await Promise.all(
    (accounts ?? []).map(async (account) => {
      const { data: snapshot } = await supabase
        .from('tiktok_snapshots')
        .select('followers, video_count, fetched_at')
        .eq('account_id', account.id)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { ...account, latest_snapshot: snapshot ?? null };
    })
  );

  return NextResponse.json({ accounts: accountsWithSnapshots });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rawHandle: string = body.handle ?? '';
  const handle = rawHandle.replace(/^@/, '').trim();

  if (!handle) {
    return NextResponse.json({ error: 'handle is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tiktok_accounts')
    .insert({ handle })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data }, { status: 201 });
}
