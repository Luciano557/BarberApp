interface FunctionErrorWithContext {
  context?: Response;
  message?: string;
}

function hasResponseContext(error: unknown): error is FunctionErrorWithContext {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'context' in error &&
      (error as FunctionErrorWithContext).context instanceof Response,
  );
}

export async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (hasResponseContext(error) && error.context) {
    try {
      const payload = await error.context.clone().json() as { error?: unknown; message?: unknown };
      const message = payload.error ?? payload.message;

      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    } catch {
      try {
        const text = await error.context.clone().text();
        if (text.trim()) return text;
      } catch {
        // Keep the fallback.
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
