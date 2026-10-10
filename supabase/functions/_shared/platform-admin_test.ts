import {
  getPlatformAdminContext,
  hasSubscriptionAccess,
  isPlatformAdminIdentity,
  mapWithConcurrency,
  numberValue,
  sanitizeMessage,
} from './platform-admin.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

Deno.test('platform admin auth rejects requests without a bearer token', async () => {
  const result = await getPlatformAdminContext(new Request('https://vittro.test/admin'));
  assert(result.error, 'Expected an authorization error response');
  assertEquals(result.error.status, 401, 'Missing bearer token must be unauthorized');
});

Deno.test('platform admin identity requires a confirmed, unbanned platform claim', () => {
  const base = {
    email: 'technical@example.invalid',
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    banned_until: undefined,
    app_metadata: { platform_role: 'platform_admin' },
  };

  assert(isPlatformAdminIdentity(base), 'Expected a valid platform identity');
  assert(!isPlatformAdminIdentity({ ...base, app_metadata: {} }), 'Tenant identity must be rejected');
  assert(!isPlatformAdminIdentity({ ...base, email_confirmed_at: undefined }), 'Unconfirmed identity must be rejected');
  assert(
    !isPlatformAdminIdentity({ ...base, banned_until: '2999-01-01T00:00:00.000Z' }),
    'Banned identity must be rejected',
  );
});

Deno.test('subscription access uses effective dates instead of stale status text', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();

  assert(hasSubscriptionAccess('trialing', future, null), 'Future trial must have access');
  assert(!hasSubscriptionAccess('trialing', past, null), 'Expired trial must not have access');
  assert(hasSubscriptionAccess('active', null, future), 'Paid future period must have access');
  assert(!hasSubscriptionAccess('active', null, null), 'Undated legacy active row must not be assumed current');
});

Deno.test('numeric DTO parsing preserves missing values as null', () => {
  assertEquals(numberValue(null), null, 'Null must not become zero');
  assertEquals(numberValue(undefined), null, 'Undefined must stay missing');
  assertEquals(numberValue(''), null, 'Empty strings must stay missing');
  assertEquals(numberValue('60000'), 60_000, 'Numeric strings must still parse');
});

Deno.test('bounded worker preserves order and never exceeds configured concurrency', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return value * 2;
  });

  assertEquals(result, [2, 4, 6, 8, 10], 'Worker result order changed');
  assert(peak <= 2, `Worker exceeded concurrency: ${peak}`);
});

Deno.test('sanitized errors redact token-like values and line breaks', () => {
  const sanitized = sanitizeMessage('access_token=secret-value\nBearer abc.def.ghi');
  assert(!sanitized.includes('secret-value'), 'Token value leaked');
  assert(!sanitized.includes('abc.def.ghi'), 'Bearer value leaked');
  assert(!sanitized.includes('\n'), 'Control characters were not removed');
});
