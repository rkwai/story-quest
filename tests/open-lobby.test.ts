import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { seedWorld } from '../src/engine/seed';
import { applyProposal } from '../src/engine/reducer';
import { playerView } from '../src/engine/view';
import { requireSameOrigin } from '../src/server/db';
import { GET as campaignsGet, POST as campaignsPost } from '../src/app/api/campaigns/route';
import { POST as deletePost } from '../src/app/api/campaigns/delete/route';
import { POST as turnPost } from '../src/app/api/turns/route';
import { POST as narrationPost } from '../src/app/api/narration/route';
import { POST as resetPost } from '../src/app/api/campaigns/reset/route';

test('open lobby migration preserves existing saves while sharing safe listings and keeping raw state private', async () => {
  const db = new PGlite();
  const originalOwner = randomUUID(), turn = randomUUID();
  const seed = seedWorld('Existing hero');
  try {
    await db.exec('create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;');
    await db.query('insert into auth.users values($1)', [originalOwner]);
    const files = (await readdir('supabase/migrations')).filter(file => file.endsWith('.sql')).sort();
    for (const file of files.filter(file => !file.endsWith('_open_playtest_lobby.sql'))) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    const existing = (await db.query<{ id: string }>('select public.create_campaign($1,$2,$3) as id', [originalOwner, seed.title, JSON.stringify(seed)])).rows[0].id;
    await db.exec(await readFile(`supabase/migrations/${files.find(file => file.endsWith('_open_playtest_lobby.sql'))}`, 'utf8'));
    const scope = (await db.query<{ id: string }>('select id from public.playtest_scope')).rows[0].id;
    assert.notEqual(scope, originalOwner);
    // A shared adventure no longer depends on retaining an Auth identity.
    await db.query('delete from auth.users where id=$1', [originalOwner]);
    assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.campaigns')).rows[0].count, 1);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const table of ['campaigns', 'turns', 'turn_traces', 'request_limits', 'playtest_scope']) {
        await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
      }
      await assert.rejects(db.query('select public.list_playtest_campaigns()'), /permission denied/);
      await assert.rejects(db.query('select public.delete_playtest_campaign($1)', [existing]), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const fresh = (await db.query<{ id: string }>('select public.create_campaign($1,$2,$3) as id', [scope, seed.title, JSON.stringify(seedWorld('New hero'))])).rows[0].id;
    const listing = (await db.query<{ id: string; character_name: string }>('select * from public.list_playtest_campaigns()')).rows;
    assert.deepEqual(new Set(listing.map(row => row.character_name)), new Set(['Existing hero', 'New hero']));
    assert.doesNotMatch(JSON.stringify(listing), /owner_id|state|seed|Hollow Choir|buried bell/);
    assert.deepEqual(new Set(listing.map(row => row.id)), new Set([existing, fresh]));
    await assert.rejects(db.query('select public.reserve_turn($1,$2,$3,$4,0)', [existing, scope, turn, 'Look']), /NOT_FOUND/);
    // The application resolves the original save's internal scope; no JWT is needed.
    await db.query('select public.reserve_turn($1,$2,$3,$4,0)', [existing, originalOwner, turn, 'Look']);
    await assert.rejects(db.query('select public.delete_playtest_campaign($1)', [existing]), /TURN_BUSY/);
    const proposal = { kind: 'action' as const, interpretation: 'Look.', clarification: null, elapsedMinutes: 5, operations: [] };
    const after = applyProposal(seed, proposal);
    const result = { id: turn, input: 'Look', interpretation: 'Your attempt: Look', changes: ['5 minutes pass.'], narration: null, revision: 1 };
    await db.query('select public.commit_turn($1,$2,$3,0,$4,$5,$6,$7,$8)', [existing, originalOwner, turn, JSON.stringify(after), JSON.stringify(proposal), JSON.stringify(result), JSON.stringify(playerView(after)), '1.0.0']);
    await db.query('insert into public.turn_traces(campaign_id,turn_id,stage) values($1,$2,$3)', [existing, turn, 'committed']);
    const verification = randomUUID();
    await db.query('insert into public.verification_runs(id,campaign_id) values($1,$2)', [verification, existing]);
    await db.query('select public.reserve_narration($1,$2,$3)', [existing, originalOwner, turn]);
    await assert.rejects(db.query('select public.delete_playtest_campaign($1)', [existing]), /NARRATION_BUSY/);
    await db.query('update public.turns set narration=$1,narration_lease_until=null where campaign_id=$2 and id=$3', ['Visible story.', existing, turn]);
    const reset = (await db.query<{ value: { id: string } }>('select public.reset_campaign($1,$2,$3) as value', [existing, originalOwner, randomUUID()])).rows[0].value.id;
    await db.query('select public.delete_playtest_campaign($1)', [existing]);
    await db.query('select public.delete_playtest_campaign($1)', [existing]);
    assert.equal((await db.query('select * from public.turns where campaign_id=$1', [existing])).rows.length, 0);
    assert.equal((await db.query('select * from public.turn_traces where campaign_id=$1', [existing])).rows.length, 0);
    assert.equal((await db.query<{ campaign_id: string | null }>('select campaign_id from public.verification_runs where id=$1', [verification])).rows[0].campaign_id, null);
    await assert.rejects(db.query('delete from public.verification_runs where id=$1', [verification]), /permission denied/);
    assert.equal((await db.query<{ reset_from_id: string | null }>('select reset_from_id from public.campaigns where id=$1', [reset])).rows[0].reset_from_id, null);
    assert.equal((await db.query<{ attempts: number }>('select attempts from public.request_limits where owner_id=$1', [scope])).rows[0].attempts, 1);
    // Shared limits cannot be bypassed through another old owner or delete/recreate.
    await db.query('update public.request_limits set attempts=100 where owner_id=$1', [scope]);
    await assert.rejects(db.query('select public.reserve_turn($1,$2,$3,$4,0)', [reset, originalOwner, randomUUID(), 'Look']), /DAILY_LIMIT/);
    for (let i = 0; i < 3; i++) await db.query('select public.create_campaign($1,$2,$3)', [scope, seed.title, JSON.stringify(seed)]);
    await assert.rejects(db.query('select public.create_campaign($1,$2,$3)', [originalOwner, seed.title, JSON.stringify(seed)]), /CAMPAIGN_LIMIT/);
    await db.query('select public.delete_playtest_campaign($1)', [fresh]);
    await db.query('select public.create_campaign($1,$2,$3)', [scope, seed.title, JSON.stringify(seed)]);
    assert.equal((await db.query<{ attempts: number }>('select attempts from public.request_limits where owner_id=$1', [scope])).rows[0].attempts, 100);
  } finally { await db.close(); }
});

test('same-origin JSON guard blocks cross-site browser mutations before any provider access', async () => {
  const url = 'https://story.example/api/campaigns';
  const blockedHeaders: Record<string, string>[] = [
    { 'content-type': 'application/json', origin: 'https://elsewhere.example' },
    { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
    { 'content-type': 'application/json', origin: 'null' },
  ];
  for (const headers of blockedHeaders) {
    const request = () => new Request(url, { method: 'POST', headers, body: '{}' });
    assert.throws(() => requireSameOrigin(request()), /CROSS_ORIGIN_REQUEST/);
    for (const route of [campaignsPost, deletePost, turnPost, narrationPost, resetPost]) {
      assert.equal((await route(request())).status, 403);
    }
  }
  assert.throws(() => requireSameOrigin(new Request(url, { method: 'POST', body: '{}' })), /INVALID_CONTENT_TYPE/);
  assert.doesNotThrow(() => requireSameOrigin(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://story.example', 'sec-fetch-site': 'same-origin' } })));
  assert.doesNotThrow(() => requireSameOrigin(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' } })));
  assert.doesNotThrow(() => requireSameOrigin(new Request('http://0.0.0.0:3000/api/campaigns', { method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost:3000', origin: 'http://localhost:3000' } })));
  assert.throws(() => requireSameOrigin(new Request('http://0.0.0.0:3000/api/campaigns', { method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost:3000', origin: 'http://attacker.example' } })), /CROSS_ORIGIN_REQUEST/);
});

test('campaign creation, listing, resume and deletion work without login and never return private snapshots', async t => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'fixture-server-only' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const scope = randomUUID(), campaign = randomUUID();
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(String(input)); requests.push(url.pathname);
    if (url.pathname === '/rest/v1/playtest_scope') return Response.json({ id: scope });
    if (url.pathname === '/rest/v1/rpc/create_campaign') {
      const body = JSON.parse(String(options?.body));
      assert.equal(body.p_owner, scope);
      assert.doesNotMatch(JSON.stringify(body.p_state), /Hollow Choir/);
      return Response.json(campaign);
    }
    if (url.pathname === '/rest/v1/rpc/list_playtest_campaigns') return Response.json([{ id: campaign, title: 'The Silence of Ashford', character_name: 'Rowan', revision: 0, archived_at: null }]);
    if (url.pathname === '/rest/v1/campaigns') return Response.json({ id: campaign, state: seedWorld(), archived_at: null });
    if (url.pathname === '/rest/v1/turns') return Response.json([]);
    if (url.pathname === '/rest/v1/rpc/delete_playtest_campaign') return Response.json(true);
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  const post = (body: unknown) => new Request('https://story.example/api/campaigns', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://story.example' }, body: JSON.stringify(body) });
  const created = await campaignsPost(post({ name: 'Rowan', premise: 'A quiet fantasy mystery.' }));
  assert.equal(created.status, 200); assert.equal((await created.json()).id, campaign);
  const list = await campaignsGet(new Request('https://story.example/api/campaigns'));
  assert.equal(list.status, 200); assert.equal((await list.json()).campaigns.length, 1);
  const resumed = await campaignsGet(new Request(`https://story.example/api/campaigns?id=${campaign}`));
  assert.equal(resumed.status, 200);
  const publicSave = await resumed.json();
  assert.equal(publicSave.view.character.name, 'Rowan');
  assert.doesNotMatch(JSON.stringify(publicSave), /Hollow Choir|buried bell|fixture-server-only|owner_id/);
  assert.equal(publicSave.state, undefined); assert.equal(publicSave.seed, undefined);
  assert.deepEqual(await (await deletePost(post({ campaignId: campaign }))).json(), { deleted: true });
  assert.ok(requests.every(path => !path.includes('/auth/')));
});
