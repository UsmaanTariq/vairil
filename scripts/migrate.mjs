#!/usr/bin/env node
/**
 * Runs supabase/schema.sql against the Supabase project via the Management API.
 * Requires SUPABASE_ACCESS_TOKEN in env (from https://supabase.com/dashboard/account/tokens).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/migrate.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local'), override: true });

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!accessToken) {
  console.error('❌  SUPABASE_ACCESS_TOKEN not set.');
  console.error('   Get one at: https://supabase.com/dashboard/account/tokens');
  console.error('   Then add it to .env.local or pass it inline:');
  console.error('   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/migrate.mjs');
  process.exit(1);
}

const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌  Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

async function runSql(label, sql) {
  console.log(`  Running: ${label}`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌  Failed (${label}):`, res.status, text);
    process.exit(1);
  }
  console.log(`  ✓ Done`);
}

console.log(`\nMigrating project: ${projectRef}\n`);

// 1. Base schema (idempotent — uses IF NOT EXISTS)
const schemaPath = join(__dirname, '..', 'supabase', 'schema.sql');
await runSql('schema.sql', readFileSync(schemaPath, 'utf8'));

// 2. All migration files in supabase/migrations/, sorted by name
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');
let migrationFiles = [];
try {
  migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
} catch {
  // No migrations directory yet — that's fine
}

for (const file of migrationFiles) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  await runSql(file, sql);
}

console.log('\n✅  All migrations complete.');
