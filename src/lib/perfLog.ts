/**
 * Telemetría mínima de tiempos para diagnosticar lentitud post-login.
 * No persiste nada y no loguea datos sensibles (sin emails, tokens ni passwords).
 *
 * Uso:
 *   const end = perfStart('profileRoles');
 *   try { ... ; end.success(); } catch (e) { end.error(e); }
 *
 * O envolviendo una promesa:
 *   await perfMeasure('organization', () => fetchOrg());
 */

const PREFIX = '[LoginPerf]';

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function perfStart(phase: string) {
  const t0 = now();
  // eslint-disable-next-line no-console
  console.info(`${PREFIX} phase=${phase}:start`);
  return {
    success(extra?: Record<string, string | number | boolean>) {
      const ms = Math.round(now() - t0);
      const extras = extra ? ' ' + Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ') : '';
      // eslint-disable-next-line no-console
      console.info(`${PREFIX} phase=${phase}:success durationMs=${ms}${extras}`);
    },
    error(err: unknown) {
      const ms = Math.round(now() - t0);
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`${PREFIX} phase=${phase}:error durationMs=${ms} error=${msg}`);
    },
    timeout() {
      const ms = Math.round(now() - t0);
      // eslint-disable-next-line no-console
      console.warn(`${PREFIX} phase=${phase}:timeout durationMs=${ms}`);
    },
  };
}

export async function perfMeasure<T>(phase: string, fn: () => Promise<T>): Promise<T> {
  const t = perfStart(phase);
  try {
    const r = await fn();
    t.success();
    return r;
  } catch (err) {
    t.error(err);
    throw err;
  }
}

export function perfEvent(phase: string, extra?: Record<string, string | number | boolean>) {
  const extras = extra ? ' ' + Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ') : '';
  // eslint-disable-next-line no-console
  console.info(`${PREFIX} phase=${phase}${extras}`);
}

/**
 * Envuelve una promesa con timeout. Si vence, rechaza con un Error que tiene
 * `name === 'TimeoutError'` para que el caller pueda diferenciarlo.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      const err = new Error(`Timeout (${ms}ms) en ${label}`);
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
    promise.then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); },
    );
  });
}

export function isTimeoutError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: string }).name === 'TimeoutError';
}
