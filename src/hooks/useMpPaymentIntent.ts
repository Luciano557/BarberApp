import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MpIntentStatus =
  | 'idle'
  | 'creating'
  | 'pending'      // Sent to terminal, waiting for customer
  | 'on_terminal'  // Terminal acknowledged and is processing
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'timeout'
  | 'error';

interface MpPaymentIntentState {
  status: MpIntentStatus;
  intentId: string | null;
  errorMessage: string | null;
}

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/** Maps MP terminal_state string to our internal status */
function mapTerminalState(terminalState: string, paymentStatus?: string): MpIntentStatus | null {
  switch (terminalState.toUpperCase()) {
    case 'OPEN':
    case 'CREATED':
      return 'pending';
    case 'ON_TERMINAL':
    case 'AT_TERMINAL':
    case 'ACTION_REQUIRED':
      return 'on_terminal';
    case 'PROCESSING':
      return 'on_terminal';
    case 'PROCESSED':
      return 'approved';
    case 'FAILED':
      return 'rejected';
    case 'CANCELED':
    case 'CANCELLED':
      return 'cancelled';
    case 'EXPIRED':
      return 'timeout';
    case 'REFUNDED':
      return 'cancelled';
    case 'FINISHED':
      if (!paymentStatus) return null; // Wait for next poll
      if (paymentStatus === 'approved') return 'approved';
      if (paymentStatus === 'rejected') return 'rejected';
      if (paymentStatus === 'cancelled') return 'cancelled';
      return 'error';
    default:
      return null; // Unknown state — keep polling
  }
}

async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const functionError = error as {
    message?: string;
    context?: Response | { response?: Response };
  } | null;
  const context = functionError?.context;
  const response = context instanceof Response
    ? context
    : context?.response instanceof Response
      ? context.response
      : null;

  if (response) {
    try {
      const payload = await response.clone().json() as { error?: string };
      if (payload?.error) return payload.error;
    } catch {
      // Fall through to the SDK message.
    }
  }

  return functionError?.message || fallback;
}

export function useMpPaymentIntent() {
  const [state, setState] = useState<MpPaymentIntentState>({
    status: 'idle',
    intentId: null,
    errorMessage: null,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIntentRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (intentId: string) => {
      stopPolling();
      activeIntentRef.current = intentId;

      // Hard timeout
      timeoutRef.current = setTimeout(() => {
        stopPolling();
        setState((s) =>
          s.status === 'pending' || s.status === 'on_terminal'
            ? { status: 'timeout', intentId: s.intentId, errorMessage: 'Tiempo agotado. El pago no fue confirmado por la terminal.' }
            : s,
        );
      }, TIMEOUT_MS);

      pollRef.current = setInterval(async () => {
        // If the intent changed (e.g. reset called), stop this polling loop
        if (activeIntentRef.current !== intentId) {
          stopPolling();
          return;
        }

        try {
          const { data, error } = await supabase.functions.invoke('mp-get-payment-status', {
            body: { payment_intent_id: intentId },
          });

          if (error || !data) return; // Transient error — keep trying

          const terminalState = data.status as string;
          const paymentStatus = data.payment_status as string | undefined;

          if (terminalState === 'NOT_FOUND') {
            stopPolling();
            setState({ status: 'error', intentId, errorMessage: 'El intento de pago no fue encontrado.' });
            return;
          }

          const mapped = mapTerminalState(terminalState, paymentStatus);
          if (mapped && mapped !== 'pending' && mapped !== 'on_terminal') {
            // Terminal reached a final state
            stopPolling();
            setState({ status: mapped, intentId, errorMessage: null });
          } else if (mapped) {
            // Update intermediate status
            setState((s) =>
              s.status !== mapped ? { ...s, status: mapped } : s,
            );
          }
        } catch {
          // Network error — keep polling, will recover
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  /**
   * Creates a payment intent on the terminal and starts polling.
   * @param deviceId - The MP device ID (mp_devices.mp_device_id)
   * @param amountPesos - Amount in ARS pesos (will be converted to centavos)
   * @param description - Optional charge description
   */
  const createIntent = useCallback(
    async (
      deviceId: string,
      amountPesos: number,
      description?: string,
    ): Promise<string | null> => {
      setState({ status: 'creating', intentId: null, errorMessage: null });

      try {
        const { data, error } = await supabase.functions.invoke('mp-create-payment-intent', {
          body: {
            device_id: deviceId,
            amount_cents: Math.round(amountPesos * 100),
            description: description ?? 'Cobro Vitro',
          },
        });

        if (error || !data?.payment_intent_id) {
          const msg = await getFunctionErrorMessage(
            error,
            'No se pudo crear el intento de pago',
          );
          setState({ status: 'error', intentId: null, errorMessage: msg });
          return null;
        }

        const intentId = data.payment_intent_id as string;
        setState({ status: 'pending', intentId, errorMessage: null });
        startPolling(intentId);
        return intentId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error inesperado';
        setState({ status: 'error', intentId: null, errorMessage: msg });
        return null;
      }
    },
    [startPolling],
  );

  /**
   * Cancels the active payment intent on the terminal.
   * @param deviceId - The MP device ID that received the original intent
   */
  const cancelIntent = useCallback(
    async (deviceId: string) => {
      stopPolling();
      const intentId = state.intentId;
      if (!intentId) {
        setState({ status: 'cancelled', intentId: null, errorMessage: null });
        return;
      }

      setState((s) => ({ ...s, status: 'cancelled' }));

      // Fire-and-forget cancellation — don't block UX on MP API response
      supabase.functions
        .invoke('mp-cancel-payment-intent', {
          body: { device_id: deviceId, payment_intent_id: intentId },
        })
        .catch((err) => console.warn('[useMpPaymentIntent] cancel error (non-critical):', err));
    },
    [state.intentId, stopPolling],
  );

  /** Resets the hook back to idle state. */
  const reset = useCallback(() => {
    stopPolling();
    activeIntentRef.current = null;
    setState({ status: 'idle', intentId: null, errorMessage: null });
  }, [stopPolling]);

  return {
    ...state,
    createIntent,
    cancelIntent,
    reset,
  };
}
