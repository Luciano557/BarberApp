import { supabase } from '@/integrations/supabase/client';
import { runReadWithRetry } from '@/lib/readRetry';

export class PortalFunctionError extends Error {
  constructor(readonly code: string, readonly status?: number) {
    super('No pudimos completar la operación.');
    this.name = 'PortalFunctionError';
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

async function responseError(data: unknown, error: unknown, response?: Response): Promise<PortalFunctionError | null> {
  const context = isObject(error) && error.context instanceof Response ? error.context : response;
  let payload = data;
  if (error && context) {
    try { payload = await context.clone().json(); } catch { /* El servidor puede responder sin JSON. */ }
  }
  if (!error && !(isObject(payload) && payload.error)) return null;
  const code = isObject(payload) && typeof payload.error === 'string' ? payload.error : 'request_failed';
  const status = context?.status ?? (isObject(error) && error.name === 'FunctionsFetchError' ? 0 : undefined);
  return new PortalFunctionError(code, status);
}

/** Solo lecturas públicas: cancelación y retries transitorios según la política existente. */
export function readPortalFunction<T>(name: string, body: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  return runReadWithRetry<T>(async (attemptSignal) => {
    const { data, error, response } = await supabase.functions.invoke(name, { body, signal: attemptSignal });
    const failure = await responseError(data, error, response);
    if (failure) return { data: null, error: failure, status: failure.status };
    if (!isObject(data)) return { data: null, error: new PortalFunctionError('invalid_response') };
    // Un objeto incompleto no prueba que no haya disponibilidad o turnos.
    const valid = name === 'get-available-dates' ? Array.isArray(data.available_dates)
      : name === 'get-availability' ? Array.isArray(data.slots)
      : name === 'get-my-turnos-by-phone' ? Array.isArray(data.turnos)
      : name === 'lookup-cliente-by-phone' ? typeof data.found === 'boolean' && (!data.found || isObject(data.cliente))
      : name === 'get-org-public' ? isObject(data.organization) && Array.isArray(data.sucursales) && Array.isArray(data.servicios) && Array.isArray(data.barberos)
      : false;
    return valid ? { data: data as T, error: null } : { data: null, error: new PortalFunctionError('invalid_response') };
  }, { signal });
}

/** Una escritura tiene un solo intento: nunca usa el retry de lecturas. */
export async function mutatePortalFunction(name: string, body: Record<string, unknown>): Promise<void> {
  const { data, error, response } = await supabase.functions.invoke(name, { body });
  const failure = await responseError(data, error, response);
  if (failure) throw failure;
  if (!isObject(data)) throw new PortalFunctionError('invalid_response');
}

export function portalErrorCode(error: unknown): string | undefined {
  return error instanceof PortalFunctionError ? error.code : undefined;
}
