export function workerLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry = JSON.stringify({ level, ts: new Date().toISOString(), message, ...data });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
}
