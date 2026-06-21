export const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const minutesToTime = (m: number): string => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const formatHHMM = (t: string) => t.slice(0, 5);

export const PX_PER_MIN = 2.05; // ~123px por hora
