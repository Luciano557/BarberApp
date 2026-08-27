import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'vittro_cookie_consent';
const EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // 90 días
const CHANGE_EVENT = 'vittro:consent-change';

export type ConsentStatus = 'accepted' | 'rejected' | null;

interface ConsentRecord {
  status: 'accepted' | 'rejected';
  decidedAt: string;
}

function readConsent(): ConsentStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as ConsentRecord;
    const decidedAt = new Date(record.decidedAt).getTime();
    if (!Number.isFinite(decidedAt) || Date.now() - decidedAt > EXPIRY_MS) return null;
    return record.status === 'accepted' || record.status === 'rejected' ? record.status : null;
  } catch {
    return null;
  }
}

function writeConsent(status: 'accepted' | 'rejected'): void {
  const record: ConsentRecord = { status, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) — no bloquea la UI.
  }
  // localStorage no es reactivo dentro de la misma pestaña (el evento nativo
  // "storage" solo dispara en otras pestañas) — este evento propio avisa al
  // banner y a useMetaPixel en la misma pestaña, sin reload.
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useConsent() {
  const [status, setStatus] = useState<ConsentStatus>(() => readConsent());

  useEffect(() => {
    const handler = () => setStatus(readConsent());
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const accept = useCallback(() => writeConsent('accepted'), []);
  const reject = useCallback(() => writeConsent('rejected'), []);

  return { status, accept, reject };
}
