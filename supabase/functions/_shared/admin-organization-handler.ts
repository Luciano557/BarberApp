import { CommercialError, commercialError, isUuid, parseCommercialMutation, type CommercialMutation } from './admin-organization-domain.ts';

export interface CommercialGateway {
  reauthenticate(password: string): Promise<boolean>;
  mutate(input: CommercialMutation, requestId: string): Promise<unknown>;
  status(organizationId: string, requestId: string): Promise<unknown>;
}
export interface CommercialHandlerDependencies {
  authorize(req: Request, requestId: string): Promise<Response | CommercialGateway>;
  enabled(): boolean;
  requestId(req: Request): string;
  reply(req: Request, body: unknown, status: number, requestId: string): Response;
}
export function createCommercialHandler(deps: CommercialHandlerDependencies) {
  return async (req: Request): Promise<Response> => {
    const requestId = deps.requestId(req);
    const error = (message: string, status: number, code: string) => deps.reply(req, { error: message, code, requestId }, status, requestId);
    if (req.method === 'OPTIONS') return deps.reply(req, null, 204, requestId);
    if (req.method !== 'POST') return error('Método no permitido.', 405, 'METHOD_NOT_ALLOWED');
    try {
      const gateway = await deps.authorize(req, requestId);
      if (gateway instanceof Response) return gateway;
      // Do not read/log passwords or other body fields before authorization.
      let body: unknown;
      const length = Number(req.headers.get('content-length') ?? 0);
      if (length > 8192) return error('Solicitud demasiado grande.', 413, 'INVALID_INPUT');
      try {
        const raw = await req.text();
        if (raw.length > 8192) return error('Solicitud demasiado grande.', 413, 'INVALID_INPUT');
        body = JSON.parse(raw);
      } catch { return error('JSON inválido.', 400, 'INVALID_JSON'); }
      if (body && typeof body === 'object' && 'action' in body && body.action === 'status') {
        const source = body as Record<string, unknown>;
        if (!isUuid(source.organizationId) || !isUuid(source.operationRequestId) || Object.keys(source).some(key => !['action', 'organizationId', 'operationRequestId'].includes(key))) {
          return error('Revisá el identificador de la operación.', 400, 'INVALID_INPUT');
        }
        return deps.reply(req, await gateway.status(source.organizationId, source.operationRequestId), 200, requestId);
      }
      if (!deps.enabled()) return error('La gestión comercial todavía no está habilitada.', 503, 'COMMERCIAL_MUTATIONS_DISABLED');
      // A stable client key is mandatory for recoverable/idempotent writes.
      if (!isUuid(req.headers.get('x-request-id'))) return error('Falta el identificador de la operación.', 400, 'INVALID_REQUEST_ID');
      const input = parseCommercialMutation(body);
      if (!await gateway.reauthenticate(input.password)) return error('No pudimos confirmar tu identidad.', 403, 'REAUTHENTICATION_FAILED');
      const result = await gateway.mutate(input, requestId);
      return deps.reply(req, result, 200, requestId);
    } catch (cause) {
      const failure = cause instanceof CommercialError ? cause : commercialError('COMMERCIAL_MUTATION_FAILED');
      // Never include cause, request bodies or raw database/provider messages.
      return error(failure.message, failure.status, failure.code);
    }
  };
}
