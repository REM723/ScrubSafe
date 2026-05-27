const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), UNITS.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${parseFloat(value.toFixed(decimals))} ${UNITS[i]}`;
}

export function arrayBufferToBlob(buffer: ArrayBuffer, mime: string): Blob {
  return new Blob([buffer], { type: mime });
}

export function savingsPercent(original: number, clean: number): number {
  if (original === 0) return 0;
  return Math.round(((original - clean) / original) * 100);
}
