import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const runId = '77777777-7777-4777-8777-777777777777';
const ownerId = '88888888-8888-4888-8888-888888888888';
const campaignId = '99999999-9999-4999-8999-999999999999';

test('Postgres playtest claims run once, stay private, and survive account or campaign removal', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create table auth.users(id uuid primary key);
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
    `);
    await db.exec(await readFile('supabase/migrations/20260917084314_story_engine.sql', 'utf8'));
    await db.exec(await readFile('supabase/migrations/20260918023239_verification_runs.sql', 'utf8'));

    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.verification_runs'), /permission denied/);
      await assert.rejects(db.query('insert into public.verification_runs(id) values ($1)', [runId]), /permission denied/);
      await assert.rejects(db.query("update public.verification_runs set status = 'passed' where id = $1", [runId]), /permission denied/);
      await assert.rejects(db.query('delete from public.verification_runs where id = $1', [runId]), /permission denied/);
      await db.exec('reset role');
    }

    await db.exec('set role service_role');
    const first = await db.query<{ id: string; status: string }>(
      'insert into public.verification_runs(id) values ($1) returning id, status', [runId],
    );
    assert.deepEqual(first.rows, [{ id: runId, status: 'running' }]);
    await assert.rejects(
      db.query('insert into public.verification_runs(id) values ($1)', [runId]),
      (error: unknown) => (error as { code?: string }).code === '23505',
    );
    const retry = await db.query('insert into public.verification_runs(id) values ($1) on conflict (id) do nothing returning id', [runId]);
    assert.equal(retry.rows.length, 0, 'a retried claim must not authorize paid work');
    await assert.rejects(db.query('delete from public.verification_runs where id = $1', [runId]), /permission denied/);
    await assert.rejects(db.query('truncate public.verification_runs'), /permission denied/);
    await assert.rejects(db.query('update public.verification_runs set id = $1 where id = $2', [campaignId, runId]), /permission denied/);

    await db.exec('reset role');
    await db.query('insert into auth.users(id) values ($1)', [ownerId]);
    await db.query("insert into public.campaigns(id, owner_id, title, seed, state) values ($1, $2, 'QA', '{}', '{}')", [campaignId, ownerId]);
    await db.exec('set role service_role');
    await db.query(`
      update public.verification_runs
      set qa_user_id = $1, campaign_id = $2, status = 'passed',
          result = '{"replayVerified":true}', finished_at = now()
      where id = $3
    `, [ownerId, campaignId, runId]);
    await assert.rejects(db.query("update public.verification_runs set status = 'retry' where id = $1", [runId]), /check constraint/);
    await db.exec('reset role');
    await db.query('delete from auth.users where id = $1', [ownerId]);
    await db.exec('set role service_role');
    const retained = await db.query<{
      status: string; qa_user_id: string | null; campaign_id: string | null;
      result: { replayVerified: boolean }; finished: boolean;
    }>('select status, qa_user_id, campaign_id, result, finished_at is not null as finished from public.verification_runs where id = $1', [runId]);
    assert.deepEqual(retained.rows, [{
      status: 'passed', qa_user_id: null, campaign_id: null,
      result: { replayVerified: true }, finished: true,
    }]);
    await assert.rejects(db.query('insert into public.verification_runs(id) values ($1)', [runId]), (error: unknown) => (error as { code?: string }).code === '23505');
  } finally {
    await db.close();
  }
});
