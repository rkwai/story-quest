import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { seedWorld } from '../src/engine/seed';
import { applyProposal } from '../src/engine/reducer';
import { playerView } from '../src/engine/view';

test('campaign reset preserves history, restores the stored seed, and protects ownership and retries', async () => {
  const db = new PGlite();
  const owner = randomUUID(), other = randomUUID(), turn = randomUUID(), reset = randomUUID();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;`);
    await db.query('insert into auth.users values ($1),($2)', [owner, other]);
    await db.exec(await readFile('supabase/migrations/20260917084314_story_engine.sql', 'utf8'));
    await db.exec(await readFile('supabase/migrations/20260918023311_campaign_reset.sql', 'utf8'));
    const seed = seedWorld('Quinn', 'An original world worth returning to.');
    const { rows: [{ id: source }] } = await db.query<{ id: string }>('select public.create_campaign($1,$2,$3) as id', [owner, seed.title, JSON.stringify(seed)]);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.reset_campaign($1,$2,$3)', [source, owner, reset]), /permission denied/);
    await db.exec('reset role; set role service_role');
    await assert.rejects(db.query('select public.reset_campaign($1,$2,$3)', [source, other, reset]), /NOT_FOUND/);
    await db.query('select public.reserve_turn($1,$2,$3,$4,0)', [source, owner, turn, 'Look around']);
    await assert.rejects(db.query('select public.reset_campaign($1,$2,$3)', [source, owner, reset]), /TURN_BUSY/);
    const proposal = { kind: 'action' as const, interpretation: 'Look around.', clarification: null, elapsedMinutes: 5, operations: [] };
    const after = applyProposal(seed, proposal);
    const result = { id: turn, input: 'Look around', interpretation: 'Look around.', changes: ['5 minutes pass.'], narration: null, revision: 1 };
    await db.query('select public.commit_turn($1,$2,$3,0,$4,$5,$6,$7,$8)', [source, owner, turn, JSON.stringify(after), JSON.stringify(proposal), JSON.stringify(result), JSON.stringify(playerView(after)), '1.0.0']);
    await db.query('insert into public.turn_traces(campaign_id,turn_id,stage,details) values($1,$2,$3,$4)', [source, turn, 'committed', '{"revision":1}']);
    const beforeTurns = (await db.query('select * from public.turns where campaign_id=$1', [source])).rows;
    const beforeTraces = (await db.query('select * from public.turn_traces where campaign_id=$1', [source])).rows;
    type Reset = { result: { id: string; replayed: boolean } };
    const first = (await db.query<Reset>('select public.reset_campaign($1,$2,$3) as result', [source, owner, reset])).rows[0].result;
    assert.notEqual(first.id, source);
    assert.equal(first.replayed, false);
    const repeat = (await db.query<Reset>('select public.reset_campaign($1,$2,$3) as result', [source, owner, reset])).rows[0].result;
    assert.deepEqual(repeat, { id: first.id, replayed: true });
    const fresh = (await db.query<{ state: unknown; seed: unknown; revision: number; archived_at: unknown; owner_id: string }>('select state,seed,revision,archived_at,owner_id from public.campaigns where id=$1', [first.id])).rows[0];
    assert.deepEqual(fresh, { state: seed, seed, revision: 0, archived_at: null, owner_id: owner });
    const original = (await db.query<{ state: unknown; archived_at: unknown }>('select state,archived_at from public.campaigns where id=$1', [source])).rows[0];
    assert.ok(original.archived_at);
    assert.deepEqual(original.state, after);
    assert.deepEqual((await db.query('select * from public.turns where campaign_id=$1', [source])).rows, beforeTurns);
    assert.deepEqual((await db.query('select * from public.turn_traces where campaign_id=$1', [source])).rows, beforeTraces);
    await assert.rejects(db.query('select public.reset_campaign($1,$2,$3)', [source, owner, randomUUID()]), /CAMPAIGN_ARCHIVED/);
    await assert.rejects(db.query('select public.reset_campaign($1,$2,$3)', [first.id, owner, reset]), /RESET_ID_REUSED/);
    await assert.rejects(db.query('select public.reserve_turn($1,$2,$3,$4,1)', [source, owner, randomUUID(), 'Change the old story']), /CAMPAIGN_ARCHIVED/);
    const replay = (await db.query<{ result: { replayed: boolean } }>('select public.reserve_turn($1,$2,$3,$4,0) as result', [source, owner, turn, 'Look around'])).rows[0].result;
    assert.equal(replay.replayed, true);
    // Repeated iteration must not consume the five active-adventure slots.
    let current = first.id;
    for (let iteration = 0; iteration < 6; iteration++) {
      current = (await db.query<Reset>('select public.reset_campaign($1,$2,$3) as result', [current, owner, randomUUID()])).rows[0].result.id;
    }
    for (let count = 0; count < 4; count++) await db.query('select public.create_campaign($1,$2,$3)', [owner, seed.title, JSON.stringify(seed)]);
    await assert.rejects(db.query('select public.create_campaign($1,$2,$3)', [owner, seed.title, JSON.stringify(seed)]), /CAMPAIGN_LIMIT/);
    await db.exec('reset role');
    assert.equal((await db.query<{ count: number }>('select count(*)::int as count from auth.users where id=$1', [owner])).rows[0].count, 1);
  } finally { await db.close(); }
});
