import { vi } from 'vitest';

const TZ_ORIGINAL = process.env.TZ;

/** Simula un navegador en la zona `browserTz` cuyo reloj marca el instante `isoInstant` (UTC). */
export function setBrowserClock(browserTz: string, isoInstant: string) {
  process.env.TZ = browserTz;
  vi.setSystemTime(new Date(isoInstant));
}

export function resetBrowserClock() {
  vi.useRealTimers();
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
}
