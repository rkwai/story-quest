import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { publicSupabaseConfig } from '../src/lib/supabase-public';
import { configurationPresence, serverSupabaseConfig } from '../src/server/config';
import { GET } from '../src/app/api/health/route';

const url = 'https://example.supabase.co';
const modern = {
  NEXT_PUBLIC_SUPABASE_URL: ` ${url} `,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_example ',
  SUPABASE_SECRET_KEY: ' sb_secret_example ',
  OPENROUTER_API_KEY: ' test-openrouter-example '
};

function configure(t: TestContext, values: Record<string, string | undefined>) {
  const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY', 'STORY_MODEL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key];
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

test('modern-only Marketplace configuration is ready without an explicit story model', t => {
  configure(t, modern);
  assert.deepEqual(publicSupabaseConfig(), { url, key: 'sb_publishable_example' });
  assert.deepEqual(serverSupabaseConfig(), { url, key: 'sb_secret_example' });
  assert.deepEqual(configurationPresence(), {
    status: 'configured',
    checks: { supabaseUrl: true, supabasePublicKey: true, supabaseServerKey: true, openrouterKey: true }
  });
});

test('legacy Supabase variables remain supported, including whitespace-only modern fallbacks', t => {
  configure(t, {
    NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: ' legacy-public ',
    SUPABASE_SERVICE_ROLE_KEY: ' legacy-server ', OPENROUTER_API_KEY: 'test-openrouter-example'
  });
  assert.equal(publicSupabaseConfig().key, 'legacy-public');
  assert.equal(serverSupabaseConfig().key, 'legacy-server');
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ' \t ';
  process.env.SUPABASE_SECRET_KEY = '\n ';
  assert.equal(publicSupabaseConfig().key, 'legacy-public');
  assert.equal(serverSupabaseConfig().key, 'legacy-server');
  assert.equal(configurationPresence().status, 'configured');
});

test('modern keys take priority when both generations are configured', t => {
  configure(t, { ...modern, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-public', SUPABASE_SERVICE_ROLE_KEY: 'legacy-server' });
  assert.equal(publicSupabaseConfig().key, 'sb_publishable_example');
  assert.equal(serverSupabaseConfig().key, 'sb_secret_example');
  assert.deepEqual(Object.keys(publicSupabaseConfig()).sort(), ['key', 'url']);
});

test('health returns only uncached presence booleans and makes no provider requests', async t => {
  configure(t, modern);
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('UNEXPECTED_PROVIDER_CALL'); });
  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.deepEqual(body, {
    status: 'configured',
    checks: { supabaseUrl: true, supabasePublicKey: true, supabaseServerKey: true, openrouterKey: true }
  });
  const serialized = JSON.stringify(body);
  for (const value of Object.values(modern)) assert.ok(!serialized.includes(value.trim()));
  assert.equal(fetch.mock.callCount(), 0);
});

test('missing or blank requirements produce false flags and a503 health response', async t => {
  configure(t, modern);
  const requirements = {
    NEXT_PUBLIC_SUPABASE_URL: 'supabaseUrl',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'supabasePublicKey',
    SUPABASE_SECRET_KEY: 'supabaseServerKey',
    OPENROUTER_API_KEY: 'openrouterKey'
  } as const;
  for (const [key, field] of Object.entries(requirements)) {
    const previous = process.env[key];
    for (const value of [undefined, ' \n ']) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
      const response = GET();
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.equal(body.status, 'not_configured');
      assert.equal(body.checks[field], false);
    }
    process.env[key] = previous;
  }
});

test('server configuration refuses browser execution', t => {
  configure(t, modern);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  assert.throws(serverSupabaseConfig, /SERVER_ONLY_CONFIGURATION/);
  assert.throws(configurationPresence, /SERVER_ONLY_CONFIGURATION/);
  assert.deepEqual(publicSupabaseConfig(), { url, key: 'sb_publishable_example' });
});
