import { useCallback, useRef } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import { adminSupabase } from '@/integrations/supabase/adminClient';
import type {
  PlatformAdminOperation,
  PlatformAdminPriceApplyInput,
  PlatformAdminPriceApplyResponse,
  PlatformAdminPriceChangeRequest,
  PlatformAdminPriceChangeResponseMap,
  PlatformAdminPricePreviewInput,
  PlatformAdminPriceProcessInput,
  PlatformAdminPriceRetryInput,
  PlatformAdminQueryParams,
  PlatformAdminQueryRequest,
  PlatformAdminQueryResponseMap,
  PlatformAdminSort,
} from '@/types/platformAdmin';

export const PLATFORM_ADMIN_QUERY_KEY = ['platform-admin'] as const;

const DEFAULT_STALE_TIME_MS = 20_000;
const DEFAULT_GC_TIME_MS = 5 * 60_000;
const MAX_PAGE_SIZE = 50;

export class PlatformAdminApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(
    message: string,
    options: {
      status?: number | null;
      code?: string | null;
      requestId?: string | null;
    } = {},
  ) {
    super(message);
    this.name = 'PlatformAdminApiError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.requestId = options.requestId ?? null;
  }
}

interface FunctionErrorPayload {
  error?: unknown;
  message?: unknown;
  code?: unknown;
  requestId?: unknown;
  request_id?: unknown;
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 300) : fallback;
}

async function toAdminApiError(error: unknown): Promise<PlatformAdminApiError> {
  const fallback = 'No pudimos completar la consulta administrativa.';
  const candidate = error as {
    message?: unknown;
    context?: Response;
  };

  let payload: FunctionErrorPayload | null = null;
  let status: number | null = null;

  if (candidate?.context instanceof Response) {
    status = candidate.context.status;
    try {
      payload = (await candidate.context.clone().json()) as FunctionErrorPayload;
    } catch {
      payload = null;
    }
  }

  const message = safeText(
    payload?.message ?? payload?.error ?? candidate?.message,
    fallback,
  );

  return new PlatformAdminApiError(message, {
    status,
    code: typeof payload?.code === 'string' ? payload.code : null,
    requestId:
      typeof payload?.requestId === 'string'
        ? payload.requestId
        : typeof payload?.request_id === 'string'
          ? payload.request_id
          : null,
  });
}

async function invokeAdminFunction<T>(
  functionName: 'platform-admin-query' | 'platform-admin-price-change',
  body: unknown,
): Promise<T> {
  const { data, error } = await adminSupabase.functions.invoke<T>(functionName, {
    body,
  });

  if (error) {
    const apiError = await toAdminApiError(error);
    if (apiError.status === 401 || apiError.status === 403) {
      try {
        await adminSupabase.auth.signOut({ scope: 'local' });
      } catch {
        // Preserve the original authorization error for the caller.
      }
    }
    throw apiError;
  }
  if (data === null || data === undefined) {
    throw new PlatformAdminApiError(
      'La API administrativa devolvió una respuesta vacía.',
    );
  }

  return data;
}

function normalizeQueryRequest<K extends PlatformAdminOperation>(
  operation: K,
  params: PlatformAdminQueryParams<K> | undefined,
): PlatformAdminQueryRequest<K> {
  const source = (params ?? {}) as PlatformAdminQueryParams<K> & {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: PlatformAdminSort;
  };
  const request: Record<string, unknown> = { operation };

  if (source.page !== undefined) {
    request.page = Math.max(1, Math.floor(source.page));
  }
  if (source.pageSize !== undefined) {
    request.pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(source.pageSize)),
    );
  }
  if (source.search !== undefined) {
    request.search = source.search.trim().slice(0, 200);
  }
  if (source.filters !== undefined) request.filters = source.filters;
  if (source.sort !== undefined) request.sort = source.sort;

  return request as PlatformAdminQueryRequest<K>;
}

export const platformAdminQueryKeys = {
  all: PLATFORM_ADMIN_QUERY_KEY,
  operation: <K extends PlatformAdminOperation>(
    operation: K,
    params?: PlatformAdminQueryParams<K>,
  ) => [...PLATFORM_ADMIN_QUERY_KEY, operation, params ?? {}] as const,
};

export interface UsePlatformAdminQueryOptions<K extends PlatformAdminOperation> {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?:
    | number
    | false
    | ((
        query: Query<PlatformAdminQueryResponseMap[K], PlatformAdminApiError>,
      ) => number | false | undefined);
}

export function usePlatformAdminQuery<K extends PlatformAdminOperation>(
  operation: K,
  params?: PlatformAdminQueryParams<K>,
  options: UsePlatformAdminQueryOptions<K> = {},
) {
  return useQuery<PlatformAdminQueryResponseMap[K], PlatformAdminApiError>({
    queryKey: platformAdminQueryKeys.operation(operation, params),
    queryFn: () =>
      invokeAdminFunction<PlatformAdminQueryResponseMap[K]>(
        'platform-admin-query',
        normalizeQueryRequest(operation, params),
      ),
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? DEFAULT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
    refetchInterval: options.refetchInterval,
    placeholderData: keepPreviousData,
    retry(failureCount, error) {
      if (error.status === 401 || error.status === 403 || error.status === 409) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function usePlatformAdminOverview(
  options?: UsePlatformAdminQueryOptions<'overview'>,
) {
  return usePlatformAdminQuery('overview', undefined, options);
}

export function usePlatformAdminOrganizations(
  params?: PlatformAdminQueryParams<'organizations'>,
  options?: UsePlatformAdminQueryOptions<'organizations'>,
) {
  return usePlatformAdminQuery('organizations', params, options);
}

export function usePlatformAdminUsers(
  params?: PlatformAdminQueryParams<'users'>,
  options?: UsePlatformAdminQueryOptions<'users'>,
) {
  return usePlatformAdminQuery('users', params, options);
}

export function usePlatformAdminSubscriptions(
  params?: PlatformAdminQueryParams<'subscriptions'>,
  options?: UsePlatformAdminQueryOptions<'subscriptions'>,
) {
  return usePlatformAdminQuery('subscriptions', params, options);
}

export function usePlatformAdminPayments(
  params?: PlatformAdminQueryParams<'payments'>,
  options?: UsePlatformAdminQueryOptions<'payments'>,
) {
  return usePlatformAdminQuery('payments', params, options);
}

export function usePlatformAdminAudit(
  params?: PlatformAdminQueryParams<'audit'>,
  options?: UsePlatformAdminQueryOptions<'audit'>,
) {
  return usePlatformAdminQuery('audit', params, options);
}

export function usePlatformAdminPriceChangeStatus(
  params?: PlatformAdminQueryParams<'price_change_status'>,
  options?: UsePlatformAdminQueryOptions<'price_change_status'>,
) {
  return usePlatformAdminQuery('price_change_status', params, options);
}

async function invokePriceChange<A extends keyof PlatformAdminPriceChangeResponseMap>(
  request: Extract<PlatformAdminPriceChangeRequest, { action: A }>,
): Promise<PlatformAdminPriceChangeResponseMap[A]> {
  return invokeAdminFunction<PlatformAdminPriceChangeResponseMap[A]>(
    'platform-admin-price-change',
    request,
  );
}

export function usePlatformAdminPricePreview() {
  return useMutation({
    mutationFn: (input: PlatformAdminPricePreviewInput) =>
      invokePriceChange({ action: 'preview', ...input }),
    retry: false,
  });
}

type SanitizedApplyInput = Omit<PlatformAdminPriceApplyInput, 'password'>;

/**
 * The confirmation password is kept in a short-lived ref instead of React
 * Query's mutation variables. This prevents it from remaining in mutation
 * cache/devtools after the request finishes.
 */
export function useApplyPlatformAdminPriceChange() {
  const queryClient = useQueryClient();
  const passwordRef = useRef<string | null>(null);
  const applyingRef = useRef(false);

  const mutation = useMutation<
    PlatformAdminPriceApplyResponse,
    PlatformAdminApiError,
    SanitizedApplyInput
  >({
    mutationFn: (input) => {
      const password = passwordRef.current;
      if (!password) {
        throw new PlatformAdminApiError(
          'Ingresá la contraseña para confirmar el cambio.',
        );
      }
      return invokePriceChange({ action: 'apply', ...input, password });
    },
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PLATFORM_ADMIN_QUERY_KEY });
    },
    gcTime: 0,
  });
  const mutateAsync = mutation.mutateAsync;
  const resetMutation = mutation.reset;

  const apply = useCallback(
    async (input: PlatformAdminPriceApplyInput) => {
      if (applyingRef.current) {
        throw new PlatformAdminApiError('Ya hay una confirmación en curso.');
      }

      applyingRef.current = true;
      passwordRef.current = input.password;
      const { password: _password, ...sanitizedInput } = input;

      try {
        return await mutateAsync(sanitizedInput);
      } finally {
        passwordRef.current = null;
        applyingRef.current = false;
      }
    },
    [mutateAsync],
  );

  const reset = useCallback(() => {
    passwordRef.current = null;
    resetMutation();
  }, [resetMutation]);

  return {
    apply,
    reset,
    data: mutation.data,
    error: mutation.error,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}

export function useProcessPlatformAdminPriceChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlatformAdminPriceProcessInput) =>
      invokePriceChange({ action: 'process', ...input }),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PLATFORM_ADMIN_QUERY_KEY });
    },
  });
}

export function useRetryPlatformAdminPriceChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlatformAdminPriceRetryInput) =>
      invokePriceChange({ action: 'retry', ...input }),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PLATFORM_ADMIN_QUERY_KEY });
    },
  });
}
