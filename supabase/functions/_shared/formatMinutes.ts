export function formatMinutesToText(minutes: number): string {
  const m = Math.max(0, Math.trunc(minutes));
  if (m < 60) {
    return m === 1 ? "1 minuto" : `${m} minutos`;
  }
  if (m % 60 === 0) {
    const h = m / 60;
    return h === 1 ? "1 hora" : `${h} horas`;
  }
  const h = Math.floor(m / 60);
  const rem = m % 60;
  const hPart = h === 1 ? "1 hora" : `${h} horas`;
  const mPart = rem === 1 ? "1 minuto" : `${rem} minutos`;
  return `${hPart} ${mPart}`;
}
